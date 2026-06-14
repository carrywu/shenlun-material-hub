import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessRelevanceWithRetry, scoreContentItem, AiServiceError } from "@/services/ai";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { createAsyncTask } from "@/lib/async-task";

// POST /api/content-items/reassess — 重新评估单个条目
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  let reassessItemId: string | null = null;
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "需要提供 id" }, { status: 400 });
    }

    const item = await db.contentItem.findUnique({
      where: { id },
      include: { source: { select: { name: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: "未找到条目" }, { status: 404 });
    }
    reassessItemId = item.id;

    const content = item.fullText ?? item.excerpt ?? "";
    if (!content || content.length < 300) {
      return NextResponse.json(
        { error: "内容过短，无法评估" },
        { status: 400 }
      );
    }

    // Create async task bound to the initiating user
    const task = await createAsyncTask("AI_ASSESS", { contentItemId: id }, user.id);

    // Run assessment and update inline (keeping existing synchronous behavior)
    const result = await assessRelevanceWithRetry(
      item.title,
      item.source?.name ?? "未知来源",
      content,
      item.contentType,
      { userId: user.id }
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
          user.id
        );
        scoreOverall = scoreResult.overall;
        scoreDetail = JSON.stringify(scoreResult.detail);
        scoredAt = new Date();
      } catch (e) {
        console.error("reassess 自动评分失败:", e instanceof Error ? e.message : e);
      }
    }

    const updated = await db.contentItem.update({
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
        // 与 assess 接口保持一致：评估结果同时刷新审核状态
        adminReviewStatus:
          result.decision === "accept" ? "pending_admin" : "rejected",
        processingStatus:
          result.decision === "accept" ? "pending" : "filtered",
        filterReason:
          result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
        // 自动评分（仅 accept 时有值，reject 时清空旧分）
        aiScore: scoreOverall,
        aiScoreDetail: scoreDetail,
        aiScoredAt: scoredAt,
      },
    });

    // Complete the async task
    const { completeAsyncTask } = await import("@/lib/async-task");
    await completeAsyncTask(task.id, {
      decision: result.decision,
      contentItemId: updated.id,
    });

    return NextResponse.json({
      success: true,
      decision: result.decision,
      reason: result.reason,
      taskId: task.id,
      item: {
        id: updated.id,
        title: updated.title,
        qualityStatus: updated.qualityStatus,
        aiDecision: updated.aiDecision,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "评估失败";
    if (reassessItemId) {
      await db.contentItem.update({
        where: { id: reassessItemId },
        data: {
          aiLastError: msg,
          aiLastFailedAt: new Date(),
          aiAssessmentError: msg,
        },
      });
    }
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status ?? 500 }
      );
    }
    console.error("Reassess error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
