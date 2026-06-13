import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCardForContentItem, AiServiceError } from "@/services/ai";
import { createDedupTask, enqueueAsyncTask, RateLimitError } from "@/lib/async-task";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
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

async function runGenerateCardTask(id: string, cardType: CardType, requestId: string, ownerUserId: string, force?: boolean) {
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
    where: { contentItemId: id, cardType, ownerUserId },
  });
  if (existingCard && !force) {
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
      cardType,
      ownerUserId
    );

    let card;
    if (existingCard && force) {
      card = await db.materialCard.update({
        where: { id: existingCard.id },
        data: {
          title: item.title.slice(0, 100),
          sourceSnapshot: aiData.sourceSnapshot,
          originalFacts: aiData.originalFacts,
          aiSummary: aiData.aiSummary,
          highlightSuggestions: aiData.highlightSuggestions,
          transferSuggestions: aiData.transferSuggestions,
          confirmed: false,
          confirmedAt: null,
        },
      });
    } else {
      card = await db.materialCard.create({
        data: {
          contentItemId: id,
          cardType,
          title: item.title.slice(0, 100),
          sourceSnapshot: aiData.sourceSnapshot,
          originalFacts: aiData.originalFacts,
          aiSummary: aiData.aiSummary,
          highlightSuggestions: aiData.highlightSuggestions,
          transferSuggestions: aiData.transferSuggestions,
          ownerUserId,
        },
      });
    }

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

    throw error;
  }
}

// POST /api/content-items/[id]/generate-card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  // P5: USER 不能生卡（防御层：requireVerifiedUser 理论上已拦截）
  if (user.role === "USER") {
    return forbiddenResponse("普通用户不能生成素材卡，请升级为认证用户");
  }
  const requestId = newRequestId();

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const cardType = (body.cardType as CardType) ?? "golden_sentence";
    const cardTypesRaw = body.cardTypes as CardType[] | undefined;
    const force = body.force === true;

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

    // P5: 准入改为 adminReviewStatus = approved
    if (item.adminReviewStatus !== "approved") {
      return errorResponse(
        "NOT_APPROVED",
        "该内容尚未通过管理员审核，无法生成素材卡",
        400,
        { adminReviewStatus: item.adminReviewStatus, requestId }
      );
    }

    // P5: 卡包模式 vs 单类型
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

    const requestedTypes: CardType[] = (
      Array.isArray(cardTypesRaw) && cardTypesRaw.length > 0
        ? cardTypesRaw
        : [cardType]
    ).filter((t) => validTypes.includes(t));

    if (requestedTypes.length === 0) {
      return errorResponse(
        "AI_RESPONSE_INVALID_JSON",
        "无效的卡片类型，请在页面提供的中文素材类型中选择",
        400,
        { requestId }
      );
    }

    // 串行 enqueue（全局并发由 async-task 限流；同用户 rateLimit 已查）
    const isBundleMode = Array.isArray(cardTypesRaw) && cardTypesRaw.length > 0;
    const tasks: Array<Record<string, unknown>> = [];
    let rateLimited: { reason: string } | null = null;
    for (const ct of requestedTypes) {
      const dup = await db.materialCard.findFirst({
        where: { contentItemId: id, cardType: ct, ownerUserId: user.id },
      });
      if (dup && !force) {
        // 单类型模式：直接 409，便于前端精准提示
        if (!isBundleMode) {
          return errorResponse(
            "MATERIAL_CARD_ALREADY_EXISTS",
            "您已为该内容生成过同类型素材卡",
            409,
            { existingCardId: dup.id, requestId }
          );
        }
        // 卡包模式：跳过已存在类型，继续处理其余
        tasks.push({ cardType: ct, duplicated: true, existingCardId: dup.id });
        continue;
      }
      try {
        const task = await createDedupTask({
          type: "CARD_GENERATE",
          userId: user.id,
          dedupeKey: `CARD_GENERATE:${user.id}:${id}:${ct}`,
          params: { contentItemId: id, cardType: ct, requestId },
          maxConcurrent: 3,
          maxDaily: 50,
        });
        enqueueAsyncTask(task, () => runGenerateCardTask(id, ct, requestId, user.id, force));
        tasks.push({ cardType: ct, taskId: task.id, duplicated: false });
      } catch (e) {
        if (e instanceof RateLimitError) {
          // 单类型模式：直接 429（还没开始任何任务）
          if (!isBundleMode) {
            return errorResponse("RATE_LIMITED", e.reason, 429, { requestId });
          }
          // 卡包模式：已入队的任务保留，标记 rateLimited 并以 202 返回部分结果。
          // dedupeKey 保证客户端重试时已运行的同类型任务被去重，不会重复生成。
          rateLimited = { reason: e.reason };
          break;
        }
        throw e;
      }
    }

    return NextResponse.json(
      rateLimited
        ? {
            accepted: true,
            requestId,
            contentItemId: id,
            tasks,
            rateLimited: true,
            rateLimitReason: rateLimited.reason,
          }
        : { accepted: true, requestId, contentItemId: id, tasks },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof AiServiceError) {
      return errorResponse(error.code as ErrorCode, error.message, error.status ?? 500, { requestId });
    }
    const errorMessage = error instanceof Error ? error.message : "素材卡生成失败";
    return errorResponse("AI_API_CALL_FAILED", errorMessage, 500, { requestId });
  }
}
