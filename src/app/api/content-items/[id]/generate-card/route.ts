import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCardForContentItem, AiServiceError } from "@/services/ai";
import type { CardType, ErrorCode } from "@/types";

function errorResponse(error: string, code: ErrorCode, status: number) {
  return NextResponse.json({ error, code }, { status });
}

// POST /api/content-items/[id]/generate-card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const cardType = (body.cardType as CardType) ?? "fact_summary";

    const validTypes: CardType[] = [
      "fact_summary",
      "argument_analysis",
      "data_highlight",
      "policy_compare",
      "case_study",
    ];
    if (!validTypes.includes(cardType)) {
      return errorResponse(
        `无效的卡片类型: ${cardType}，支持: ${validTypes.join(", ")}`,
        "AI_RESPONSE_INVALID_JSON",
        400
      );
    }

    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { name: true } },
      },
    });

    if (!item) {
      return errorResponse("内容条目不存在", "CONTENT_ITEM_NOT_FOUND", 404);
    }

    if (!item.fullText) {
      return errorResponse("该内容条目没有全文，无法生成素材卡", "NO_FULL_TEXT", 400);
    }

    if (item.aiDecision !== "accept") {
      return NextResponse.json(
        {
          error: "该内容尚未通过 AI 评估或已被拒绝，请先进行 AI 评估",
          code: "AI_DECISION_NOT_ACCEPT" as ErrorCode,
          aiDecision: item.aiDecision,
          aiReason: item.aiReason,
        },
        { status: 400 }
      );
    }

    const existingCard = await db.materialCard.findFirst({
      where: { contentItemId: id, cardType },
    });
    if (existingCard) {
      return NextResponse.json(
        {
          error: "该内容已存在同类型素材卡",
          code: "MATERIAL_CARD_ALREADY_EXISTS" as ErrorCode,
          existingCardId: existingCard.id,
        },
        { status: 409 }
      );
    }

    const aiData = await generateCardForContentItem(
      item.title,
      item.source?.name ?? "未知来源",
      item.fullText,
      cardType
    );

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

    await db.contentItem.update({
      where: { id },
      data: { processingStatus: "card_generated" },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Failed to generate card:", error);

    const { id } = await params;
    const errorMessage = error instanceof Error ? error.message : "素材卡生成失败";

    // Persist failure status to DB
    try {
      await db.contentItem.update({
        where: { id },
        data: {
          processingStatus: "failed",
          aiAssessmentError: errorMessage,
        },
      });
    } catch (dbError) {
      console.error("Failed to persist error status:", dbError);
    }

    // Structured error from AiServiceError
    if (error instanceof AiServiceError) {
      return errorResponse(error.message, error.code, 500);
    }

    return errorResponse(
      errorMessage,
      "AI_API_CALL_FAILED",
      500
    );
  }
}
