import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessRelevanceWithRetry } from "@/services/ai";

// POST /api/content-items/reassess — 重新评估单个条目
export async function POST(request: NextRequest) {
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

    const result = await assessRelevanceWithRetry(
      item.title,
      item.source?.name ?? "未知来源",
      content,
      item.contentType
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

    return NextResponse.json({
      success: true,
      decision: result.decision,
      reason: result.reason,
      item: {
        id: updated.id,
        title: updated.title,
        qualityStatus: updated.qualityStatus,
        aiDecision: updated.aiDecision,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "评估失败";
    console.error("Reassess error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
