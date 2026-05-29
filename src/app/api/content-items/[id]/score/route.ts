import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreContentItem } from "@/services/ai";

// POST /api/content-items/[id]/score
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch content item
    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { name: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    if (!item.fullText && !item.excerpt) {
      return NextResponse.json(
        { error: "该内容条目没有全文或摘要，无法评分" },
        { status: 400 }
      );
    }

    // Score with AI
    const scoreResult = await scoreContentItem(
      item.title,
      item.source?.name ?? "未知来源",
      item.fullText ?? item.excerpt ?? "",
      item.contentType
    );

    // Save score to database
    const updated = await db.contentItem.update({
      where: { id },
      data: {
        aiScore: scoreResult.overall,
        aiScoreDetail: JSON.stringify(scoreResult.detail),
        aiScoredAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updated.id,
      aiScore: updated.aiScore,
      aiScoreDetail: scoreResult.detail,
      aiScoredAt: updated.aiScoredAt,
    });
  } catch (error) {
    console.error("Failed to score content item:", error);
    return NextResponse.json(
      {
        error: `AI 评分失败: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    );
  }
}

// GET /api/content-items/[id]/score — 获取已有的评分结果
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const item = await db.contentItem.findUnique({
      where: { id },
      select: {
        id: true,
        aiScore: true,
        aiScoreDetail: true,
        aiScoredAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    return NextResponse.json({
      id: item.id,
      aiScore: item.aiScore,
      aiScoreDetail: item.aiScoreDetail ? JSON.parse(item.aiScoreDetail) : null,
      aiScoredAt: item.aiScoredAt,
    });
  } catch (error) {
    console.error("Failed to fetch score:", error);
    return NextResponse.json({ error: "获取评分失败" }, { status: 500 });
  }
}
