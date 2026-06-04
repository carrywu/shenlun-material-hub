import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCardForContentItem, AiServiceError } from "@/services/ai";
import type { CardType, ErrorCode } from "@/types";

function newRequestId(): string {
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: code, code, message, status, ...extra }, { status });
}

// POST /api/content-items/[id]/generate-card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = newRequestId();
  let id = "";

  try {
    ({ id } = await params);
    const body = await request.json().catch(() => ({}));
    const cardType = (body.cardType as CardType) ?? "golden_sentence";

    const validTypes: CardType[] = [
      "golden_sentence",
      "standard_expression",
      "case_material",
      "countermeasure",
      "problem_statement",
      "reason_analysis",
      "policy_expression",
      "person_story",
      "article_structure",
    ];
    if (!validTypes.includes(cardType)) {
      return errorResponse(
        "AI_RESPONSE_INVALID_JSON",
        `无效的卡片类型，请在页面提供的中文素材类型中选择`,
        400,
        { requestId }
      );
    }

    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { name: true } },
      },
    });

    if (!item) {
      return errorResponse("CONTENT_ITEM_NOT_FOUND", "内容条目不存在", 404, { requestId });
    }

    if (!item.fullText) {
      return errorResponse("NO_FULL_TEXT", "该内容条目没有全文，无法生成素材卡", 400, { requestId });
    }

    if (item.aiDecision !== "accept") {
      return errorResponse(
        "AI_DECISION_NOT_ACCEPT",
        "该内容尚未通过 AI 评估或已被拒绝，请先进行 AI 评估",
        400,
        { aiDecision: item.aiDecision, aiReason: item.aiReason, requestId }
      );
    }

    const existingCard = await db.materialCard.findFirst({
      where: { contentItemId: id, cardType },
    });
    if (existingCard) {
      return errorResponse(
        "MATERIAL_CARD_ALREADY_EXISTS",
        "该内容已存在同类型素材卡",
        409,
        { existingCardId: existingCard.id, requestId }
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
    const errorMessage = error instanceof Error ? error.message : "素材卡生成失败";

    if (error instanceof AiServiceError) {
      console.error("Failed to generate card", {
        requestId,
        code: error.code,
        status: error.status,
        source: error.diagnostics?.source,
        baseURL: error.diagnostics?.baseURL,
        model: error.diagnostics?.model,
        keySuffix: error.diagnostics?.keySuffix,
        providerMessage: error.diagnostics?.providerMessage,
      });
    } else {
      console.error("Failed to generate card", { requestId, error: errorMessage });
    }

    // Persist failure status to DB
    if (id) {
      try {
        await db.contentItem.update({
          where: { id },
          data: {
            processingStatus: "failed",
            aiAssessmentError: `[${requestId}] ${errorMessage}`,
          },
        });
      } catch (dbError) {
        console.error("Failed to persist error status", { requestId, error: dbError instanceof Error ? dbError.message : "unknown" });
      }
    }

    if (error instanceof AiServiceError) {
      return errorResponse(error.code, error.message, error.status ?? 500, {
        requestId,
        source: error.diagnostics?.source,
        baseURL: error.diagnostics?.baseURL,
        model: error.diagnostics?.model,
        keySuffix: error.diagnostics?.keySuffix,
      });
    }

    return errorResponse("AI_API_CALL_FAILED", errorMessage, 500, { requestId });
  }
}
