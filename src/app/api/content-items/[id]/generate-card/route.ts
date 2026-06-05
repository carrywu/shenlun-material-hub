import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCardForContentItem, AiServiceError } from "@/services/ai";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
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

async function runGenerateCardTask(id: string, cardType: CardType, requestId: string) {
  const item = await db.contentItem.findUnique({
    where: { id },
    include: {
      source: { select: { name: true } },
    },
  });

  if (!item?.fullText) {
    throw new Error("该内容条目没有全文，无法生成素材卡");
  }

  const existingCard = await db.materialCard.findFirst({
    where: { contentItemId: id, cardType },
  });
  if (existingCard) {
    return {
      contentItemId: id,
      cardType,
      existingCardId: existingCard.id,
      duplicated: true,
    };
  }

  try {
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

    return {
      cardId: card.id,
      contentItemId: id,
      cardType,
      duplicated: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "素材卡生成失败";

    await db.contentItem.update({
      where: { id },
      data: {
        processingStatus: "failed",
        aiAssessmentError: `[${requestId}] ${errorMessage}`,
      },
    });

    if (error instanceof AiServiceError) {
      throw new Error(error.message);
    }

    throw error;
  }
}

// POST /api/content-items/[id]/generate-card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  const requestId = newRequestId();

  try {
    const { id } = await params;
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
        "无效的卡片类型，请在页面提供的中文素材类型中选择",
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

    const task = await createAsyncTask("CARD_GENERATE", {
      contentItemId: id,
      cardType,
      requestId,
    });

    enqueueAsyncTask(task, () => runGenerateCardTask(id, cardType, requestId));

    return NextResponse.json(
      {
        accepted: true,
        taskId: task.id,
        status: "PENDING",
        contentItemId: id,
        cardType,
        requestId,
        message: "已加入后台素材卡生成队列",
      },
      { status: 202 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "素材卡生成失败";
    return errorResponse("AI_API_CALL_FAILED", errorMessage, 500, { requestId });
  }
}
