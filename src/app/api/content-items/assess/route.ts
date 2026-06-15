import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { assessRelevanceWithRetry, scoreContentItem, AiServiceError } from "@/services/ai";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const DEFAULT_CONCURRENCY = 3;

async function assessSingleItem(
  item: {
    id: string;
    title: string;
    contentType: string;
    fullText: string | null;
    excerpt: string | null;
    contentHash: string | null;
    source: { name: string } | null;
  },
  errors: string[],
  userId?: string
): Promise<"accepted" | "rejected" | "skipped" | "error"> {
  const content = item.fullText ?? item.excerpt ?? "";
  if (!content || content.length < 300) {
    errors.push(`[${item.title}] 内容过短，跳过`);
    return "skipped";
  }

  try {
    const result = await assessRelevanceWithRetry(
      item.title,
      item.source?.name ?? "未知来源",
      content,
      item.contentType,
      { userId }
    );

    // 评估通过后自动评分（reject 的文章不浪费 AI 调用）。
    // 评分失败不影响评估结果，只记日志。
    let scoreOverall: number | null = null;
    let scoreDetail: string | null = null;
    let scoredAt: Date | null = null;
    if (result.decision === "accept") {
      try {
        const scoreResult = await scoreContentItem(
          item.title,
          item.source?.name ?? "未知来源",
          content,
          item.contentType,
          userId
        );
        scoreOverall = scoreResult.overall;
        scoreDetail = JSON.stringify(scoreResult.detail);
        scoredAt = new Date();
      } catch (e) {
        console.error("assess 自动评分失败:", e instanceof Error ? e.message : e);
      }
    }

    await db.contentItem.update({
      where: { id: item.id },
      data: {
        aiDecision: result.decision,
        aiReason: result.reason,
        contentGenre: result.contentGenre,
        aiCategories: JSON.stringify(result.categories),
        aiUsableFor: JSON.stringify(result.usableFor),
        aiSummary: result.summary || null,
        aiQuotes: JSON.stringify(result.quotes),
        aiAssessedAt: new Date(),
        aiAssessmentError: null,
        aiAssessmentSource: "ai-runtime",
        aiAssessmentModel: process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? null,
        aiPromptVersion: "article_evaluation:v1",
        aiContentHash: item.contentHash ?? null,
        aiLastError: null,
        aiLastFailedAt: null,
        qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
        adminReviewStatus:
          result.decision === "accept" ? "pending_admin" : "rejected",
        // 自动评分（仅 accept 时有值，reject 时清空旧分）
        aiScore: scoreOverall,
        aiScoreDetail: scoreDetail,
        aiScoredAt: scoredAt,
        processingStatus:
          result.decision === "accept" ? "pending" : "filtered",
        filterReason:
          result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
      },
    });

    return result.decision === "accept" ? "accepted" : "rejected";
  } catch (error) {
    const msg = error instanceof Error ? error.message : "评估失败";
    errors.push(`[${item.title}] ${msg}`);

    try {
      await db.contentItem.update({
        where: { id: item.id },
        data: {
          aiAssessmentError: msg,
          aiLastError: msg,
          aiLastFailedAt: new Date(),
          // aiAssessedAt 不在失败时设置 — 只有真正完成评估才标记已评估
          adminReviewStatus: "pending_ai",
        },
      });
    } catch (updateError) {
      // 如果错误状态的写入也失败（如列不存在），至少记录日志不崩溃
      console.error(`[assess] Failed to write error state for item ${item.id}:`, updateError);
    }

    return "error";
  }
}

async function runAssessTask(
  ids: string[] | undefined,
  retryFailed: boolean | undefined,
  reassess: boolean | undefined,
  concurrency: number,
  userId?: string
) {
  let whereClause: Record<string, unknown>;

  if (retryFailed) {
    whereClause = {
      qualityStatus: "candidate",
      aiDecision: null,
      aiAssessmentError: { not: null },
    };
    if (ids && ids.length > 0) {
      whereClause.id = { in: ids };
    }
  } else if (reassess) {
    // 重新评估：允许对任意已有评估结果的文章再次评估。
    // 不限制 qualityStatus —— 已通过(accepted)或被过滤(filtered)的文章都应能重评。
    whereClause = {
      id: { in: ids ?? [] },
    };
  } else {
    whereClause = {
      id: { in: ids ?? [] },
      qualityStatus: "candidate",
      aiDecision: null,
    };
  }

  const items = await db.contentItem.findMany({
    where: whereClause,
    include: {
      source: { select: { name: true } },
    },
  });

  let accepted = 0;
  let rejected = 0;
  let errorsCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((item) => assessSingleItem(item, errors, userId))
    );

    for (const result of results) {
      if (result === "accepted") accepted++;
      else if (result === "rejected") rejected++;
      else if (result === "error") errorsCount++;
    }
  }

  return {
    assessed: items.length,
    accepted,
    rejected,
    errors_count: errorsCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// POST /api/content-items/assess — 批量 AI 评估内容条目
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const body = await request.json();
    const { ids, retryFailed, reassess, concurrency: rawConcurrency } = body;

    const concurrency = Math.min(
      10,
      Math.max(1, rawConcurrency ?? DEFAULT_CONCURRENCY)
    );

    if (!retryFailed && (!ids || !Array.isArray(ids) || ids.length === 0)) {
      return NextResponse.json(
        { error: "需要提供 ids 数组" },
        { status: 400 }
      );
    }

    let whereClause: Record<string, unknown>;
    if (retryFailed) {
      whereClause = {
        qualityStatus: "candidate",
        aiDecision: null,
        aiAssessmentError: { not: null },
      };
      if (ids && Array.isArray(ids) && ids.length > 0) {
        whereClause.id = { in: ids };
      }
    } else if (reassess) {
      // 重新评估：允许已通过、已拒绝、已过滤等已有结果的文章再次评估。
      // 与 runAssessTask 的执行查询保持一致，避免入队前 count 阶段误判为没有可评估条目。
      whereClause = {
        id: { in: ids },
      };
    } else {
      whereClause = {
        id: { in: ids },
        qualityStatus: "candidate",
        aiDecision: null,
      };
    }

    const count = await db.contentItem.count({ where: whereClause });
    if (count === 0) {
      return NextResponse.json({
        message: retryFailed
          ? "没有需要重试的失败评估"
          : "没有可评估的条目（可能已被评估或质量不达标）",
        assessed: 0,
      });
    }

    const task = await createAsyncTask("AI_ASSESS", {
      ids,
      retryFailed,
      concurrency,
      itemCount: count,
    });

    enqueueAsyncTask(task, () => runAssessTask(ids, retryFailed, reassess, concurrency, user.id));

    return NextResponse.json(
      {
        accepted: true,
        taskId: task.id,
        status: "PENDING",
        queuedCount: count,
        message: `已加入后台 AI 评估队列，共 ${count} 条`,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status ?? 500 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "评估执行失败" },
      { status: 500 }
    );
  }
}
