import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/review - 获取复习用的素材卡
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "random";
    const category = searchParams.get("category");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    if (mode === "random") {
      // Get random cards - fetch more and shuffle
      const cards = await db.materialCard.findMany({
        where,
        include: {
          article: { select: { id: true, title: true, source: true } },
          reviewRecords: { orderBy: { reviewedAt: "desc" }, take: 1 },
        },
        take: Math.min(limit * 3, 100),
      });

      // Shuffle and take requested amount
      const shuffled = cards.sort(() => Math.random() - 0.5).slice(0, limit);

      return NextResponse.json({ data: shuffled, mode: "random" });
    }

    if (mode === "unreviewed") {
      // Cards that have never been reviewed
      const cards = await db.materialCard.findMany({
        where: {
          ...where,
          reviewRecords: { none: {} },
        },
        include: {
          article: { select: { id: true, title: true, source: true } },
          reviewRecords: true,
        },
        orderBy: { createdAt: "asc" },
        take: limit,
      });

      return NextResponse.json({ data: cards, mode: "unreviewed" });
    }

    if (mode === "weak") {
      // Cards with low average review quality
      const allCards = await db.materialCard.findMany({
        where,
        include: {
          article: { select: { id: true, title: true, source: true } },
          reviewRecords: true,
        },
      });

      // Sort by average quality (ascending), unreviewed first
      const scored = allCards
        .map((card) => {
          const avgQuality =
            card.reviewRecords.length > 0
              ? card.reviewRecords.reduce((sum, r) => sum + r.quality, 0) /
                card.reviewRecords.length
              : 0;
          return { ...card, avgQuality };
        })
        .sort((a, b) => a.avgQuality - b.avgQuality)
        .slice(0, limit);

      return NextResponse.json({ data: scored, mode: "weak" });
    }

    return NextResponse.json(
      { error: "无效的 mode 参数，支持 random/unreviewed/weak" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Review fetch failed:", error);
    return NextResponse.json({ error: "获取复习数据失败" }, { status: 500 });
  }
}

// POST /api/review - 记录复习
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardId, quality } = body as { cardId: string; quality?: number };

    if (!cardId) {
      return NextResponse.json({ error: "请提供 cardId" }, { status: 400 });
    }

    const card = await db.materialCard.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    const record = await db.reviewRecord.create({
      data: {
        materialCardId: cardId,
        quality: quality ?? 3,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Record review failed:", error);
    return NextResponse.json({ error: "记录复习失败" }, { status: 500 });
  }
}
