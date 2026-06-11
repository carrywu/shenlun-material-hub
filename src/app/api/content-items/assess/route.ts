import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { assessRelevanceWithRetry, AiServiceError } from "@/services/ai";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const DEFAULT_CONCURRENCY = 3;

async function assessSingleItem(
  item: {
    id: string;
    title: string;
    contentType: string;
    fullText: string | null;
    excerpt: string | null;
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
        qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
        adminReviewStatus:
          result.decision === "accept" ? "pending_admin" : "rejected",
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

    await db.contentItem.update({
      where: { id: item.id },
      data: {
        aiAssessmentError: msg,
        aiAssessedAt: new Date(),
        adminReviewStatus: "pending_ai",
      },
    });

    return "error";
  }
}

async function runAssessTask(
  ids: string[] | undefined,
  retryFailed: boolean | undefined,
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
    const { ids, retryFailed, concurrency: rawConcurrency } = body;

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

    enqueueAsyncTask(task, () => runAssessTask(ids, retryFailed, concurrency, user.id));

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
