import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCardForContentItem } from "@/services/ai";
import type { CardType } from "@/types";

// POST /api/content-items/[id]/generate-card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const cardType = (body.cardType as CardType) ?? "fact_summary";

    // Validate cardType
    const validTypes: CardType[] = [
      "fact_summary",
      "argument_analysis",
      "data_highlight",
      "policy_compare",
      "case_study",
    ];
    if (!validTypes.includes(cardType)) {
      return NextResponse.json(
        { error: `无效的卡片类型: ${cardType}，支持: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

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

    if (!item.fullText) {
      return NextResponse.json(
        { error: "该内容条目没有全文，无法生成素材卡" },
        { status: 400 }
      );
    }

    // P0-9: 检查是否已通过 AI 评估
    if (item.aiDecision !== "accept") {
      return NextResponse.json(
        {
          error: "该内容尚未通过 AI 评估或已被拒绝，请先进行 AI 评估",
          aiDecision: item.aiDecision,
          aiReason: item.aiReason,
        },
        { status: 400 }
      );
    }

    // Generate card with AI
    const aiData = await generateCardForContentItem(
      item.title,
      item.source?.name ?? "未知来源",
      item.fullText,
      cardType
    );

    // Save card to database
    const card = await db.materialCard.create({
      data: {
        contentItemId: id,
        cardType,
        title: item.title.slice(0, 100),
        sourceSnapshot: aiData.sourceSnapshot,
        originalFacts: aiData.originalFacts,
        aiSummary: aiData.aiSummary,
        highlightSuggestions: aiData.highlightSuggestions,
        transferSuggestions: aiData.transferSuggestions,
      },
    });

    // Update content item processing status
    await db.contentItem.update({
      where: { id },
      data: { processingStatus: "card_generated" },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Failed to generate card:", error);
    return NextResponse.json(
      { error: "素材卡生成失败，请检查 AI 配置或稍后重试" },
      { status: 500 }
    );
  }
}
