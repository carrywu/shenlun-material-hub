import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncToIma, syncBatchToIma, getSyncStatus, getSyncHistory } from "@/services/ima-sync";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/sync - 同步素材卡到 ima 知识库
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
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
        select: { id: true, confirmed: true },
      });
      if (!card) {
        return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
      }
      if (!card.confirmed) {
        return NextResponse.json({ error: "素材卡尚未确认，请先确认后再同步" }, { status: 400 });
      }

      const result = await syncToIma(cardId, user.id);
      return NextResponse.json(result);
    }

    // Batch sync
    if (cardIds && cardIds.length > 0) {
      if (cardIds.length > 50) {
        return NextResponse.json(
          { error: "单次最多批量同步 50 张素材卡" },
          { status: 400 }
        );
      }

      const existingCards = await db.materialCard.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, confirmed: true },
      });

      const existingIds = new Set(existingCards.map((c) => c.id));
      const invalidIds = cardIds.filter((id) => !existingIds.has(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: `以下素材卡不存在: ${invalidIds.join(", ")}` },
          { status: 404 }
        );
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

      const result = await syncBatchToIma(cardIds, undefined, user.id);
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
  const user = await requireAdmin(request);
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

    // Query specific sync record status
    if (syncRecordId) {
      const record = await getSyncStatus(syncRecordId);
      return NextResponse.json(record);
    }

    // Query sync history for a card
    if (cardId) {
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") ?? "20"))
      );
      const records = await getSyncHistory(cardId, limit);
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
