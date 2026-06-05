import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { ownerScopeWhere } from "@/lib/data-isolation";

// GET /api/review - 获取复习用的素材卡
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "random";
    const cardType = searchParams.get("category");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));

    const where: Record<string, unknown> = {};
    if (cardType) where.cardType = cardType;

    // Multi-user data isolation: restrict to owned cards
    const ownerFilter = ownerScopeWhere(user);

    if (mode === "random") {
      const cards = await db.materialCard.findMany({
        where: { ...where, ...ownerFilter },
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              source: { select: { name: true } },
            },
          },
        },
        take: Math.min(limit * 3, 100),
      });

      const shuffled = cards.sort(() => Math.random() - 0.5).slice(0, limit);

      return NextResponse.json({ data: shuffled, mode: "random" });
    }

    if (mode === "unreviewed") {
      const cards = await db.materialCard.findMany({
        where: {
          ...where,
          ...ownerFilter,
          confirmed: false,
        },
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              source: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
      });

      return NextResponse.json({ data: cards, mode: "unreviewed" });
    }

    if (mode === "weak") {
      // Cards that are not confirmed (treated as "weak" / not yet mastered)
      const cards = await db.materialCard.findMany({
        where: {
          ...where,
          ...ownerFilter,
          confirmed: false,
        },
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              source: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return NextResponse.json({ data: cards, mode: "weak" });
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

// POST /api/review - 记录复习（将素材卡标记为已确认）
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { cardId } = body as { cardId: string; quality?: number };

    if (!cardId) {
      return NextResponse.json({ error: "请提供 cardId" }, { status: 400 });
    }

    const card = await db.materialCard.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    // Verify ownership (ADMIN can confirm any, others only their own)
    if (user.role !== "ADMIN" && card.ownerUserId !== user.id) {
      return NextResponse.json({ error: "无权操作此素材卡" }, { status: 403 });
    }

    const updated = await db.materialCard.update({
      where: { id: cardId },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, card: updated });
  } catch (error) {
    console.error("Record review failed:", error);
    return NextResponse.json({ error: "记录复习失败" }, { status: 500 });
  }
}
