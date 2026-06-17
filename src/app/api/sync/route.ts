import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ImaService, getSyncStatus, getSyncHistory, canAccessSyncRecord } from "@/services/ima-sync";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

// POST /api/sync - 同步素材卡到 ima 知识库
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
    const { cardId, cardIds } = body as {
      cardId?: string;
      cardIds?: string[];
    };

    // Single card sync
    if (cardId && !cardIds) {
      const card = await db.materialCard.findUnique({
        where: { id: cardId },
        select: { id: true, confirmed: true, ownerUserId: true, archivedAt: true },
      });
      if (!card) {
        return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
      }
      // P0-1: 同步只能同步自己的素材卡。ADMIN 也不例外（需求 2.3/5.2：
      // ADMIN 只能把自己的卡同步到自己的 IMA）。同时排除 legacy null-owner 公共卡。
      if (card.ownerUserId !== user.id) {
        return forbiddenResponse("只能同步自己的素材卡");
      }
      if (!card.confirmed) {
        return NextResponse.json({ error: "素材卡尚未确认，请先确认后再同步" }, { status: 400 });
      }
      if (card.archivedAt) {
        return NextResponse.json({ error: "已归档的素材卡不能同步" }, { status: 400 });
      }

      const item = await ImaService.syncMaterialCard({ materialCardId: cardId, userId: user.id });
      const result = {
        success: item.status !== "failed",
        status: item.status,
        syncRecordId: item.syncRecordId,
        imaDocumentId: item.imaDocumentId,
        errorCode: item.errorCode,
        error: item.errorMessage,
      };

      await auditLog({
        userId: user.id,
        action: "sync",
        resource: "MaterialCard",
        resourceId: cardId,
      });

      return NextResponse.json(result);
    }

    // Batch sync
    if (cardIds) {
      if (cardIds.length === 0) {
        return NextResponse.json(
          { error: "请先选择要同步的素材卡" },
          { status: 400 }
        );
      }

      if (cardIds.length > 50) {
        return NextResponse.json(
          { error: "单次最多批量同步 50 张素材卡" },
          { status: 400 }
        );
      }

      const existingCards = await db.materialCard.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, confirmed: true, ownerUserId: true, archivedAt: true },
      });

      const existingIds = new Set(existingCards.map((c) => c.id));
      const invalidIds = cardIds.filter((id) => !existingIds.has(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: `以下素材卡不存在: ${invalidIds.join(", ")}` },
          { status: 404 }
        );
      }

      // P0-1: 批量同步也只能同步自己的卡（ADMIN 也不例外）。同时排除 null-owner 公共卡与归档卡。
      const unauthorized = existingCards.filter(
        (c) => c.ownerUserId !== user.id || c.archivedAt,
      );
      if (unauthorized.length > 0) {
        return forbiddenResponse("只能同步自己的素材卡（已归档或他人素材卡不可同步）");
      }

      const unconfirmedIds = existingCards
        .filter((c) => !c.confirmed)
        .map((c) => c.id);

      if (unconfirmedIds.length > 0) {
        return NextResponse.json(
          { error: `以下素材卡尚未确认: ${unconfirmedIds.join(", ")}` },
          { status: 400 }
        );
      }

      const result = await ImaService.batchSyncMaterialCards({
        materialCardIds: cardIds,
        userId: user.id,
      });

      await auditLog({
        userId: user.id,
        action: "sync",
        resource: "MaterialCard",
        detail: { batchCount: cardIds.length },
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "请提供 cardId 或 cardIds 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "同步失败，请检查 IMA_API_KEY 配置" },
      { status: 500 }
    );
  }
}

// GET /api/sync - 查询同步状态或历史
export async function GET(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const syncRecordId = searchParams.get("syncRecordId");
    const cardId = searchParams.get("cardId");

    const isAdmin = user.role === "ADMIN";

    // Query specific sync record status
    if (syncRecordId) {
      const record = await getSyncStatus(syncRecordId);
      // P0-2: 非 owner 访问他人 SyncRecord 返回 404（隐藏存在）
      if (!canAccessSyncRecord(record, user.id, isAdmin)) {
        return NextResponse.json({ error: "同步记录不存在" }, { status: 404 });
      }
      return NextResponse.json(record);
    }

    // Query sync history for a card
    if (cardId) {
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") ?? "20"))
      );
      const records = await getSyncHistory(cardId, limit, user.id, isAdmin);
      return NextResponse.json(records);
    }

    return NextResponse.json(
      { error: "请提供 syncRecordId 或 cardId 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Query sync status failed:", error);
    return NextResponse.json(
      { error: "查询同步状态失败" },
      { status: 500 }
    );
  }
}
