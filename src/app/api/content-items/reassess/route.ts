import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessRelevanceWithRetry, AiServiceError } from "@/services/ai";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";

// POST /api/content-items/reassess — 重新评估单个条目
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
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
        qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
        processingStatus:
          result.decision === "accept" ? "pending" : "filtered",
        filterReason:
          result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
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
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status ?? 500 }
      );
    }
    const msg = error instanceof Error ? error.message : "评估失败";
    console.error("Reassess error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
