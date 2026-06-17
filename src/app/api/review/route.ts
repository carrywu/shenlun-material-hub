import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { ownedResourceWhere, mergeWhere } from "@/lib/data-isolation";

// GET /api/review - 获取复习用的素材卡或收藏文章
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));

    // P1-2: 收藏文章复习——返回当前用户收藏的 approved 文章（仅自己）
    if (type === "article") {
      const favorites = await db.articleFavorite.findMany({
        where: { userId: user.id },
        include: {
          contentItem: {
            select: {
              id: true, title: true, excerpt: true, fullText: true,
              adminReviewStatus: true, visibility: true,
              source: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit * 3, 100),
      });
      // 仅保留 approved（下架/拒绝的收藏文章不进复习）
      const approved = favorites
        .filter((f) => f.contentItem?.adminReviewStatus === "approved")
        .map((f) => f.contentItem)
        .slice(0, limit);
      return NextResponse.json({ data: approved, mode: "article" });
    }

    const mode = searchParams.get("mode") ?? "random";
    const cardType = searchParams.get("category");

    const where: Record<string, unknown> = { archivedAt: null };
    if (cardType) where.cardType = cardType;

    // P1-001: Multi-user data isolation — only own cards (legacy null-owner is admin-only)
    const ownerFilter = ownedResourceWhere(user);

    if (mode === "random") {
      const cards = await db.materialCard.findMany({
        where: mergeWhere(where, ownerFilter),
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
          ...mergeWhere(where, ownerFilter),
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
          ...mergeWhere(where, ownerFilter),
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
    const { type } = body as { type?: "article" | "card"; cardId?: string; contentItemId?: string; mastery?: number };

    // P1-2: 文章复习——记录收藏文章的复习状态到 ArticleReviewState（用户私有）
    if (type === "article") {
      const { contentItemId, mastery } = body as { contentItemId?: string; mastery?: number };
      if (!contentItemId) {
        return NextResponse.json({ error: "请提供 contentItemId" }, { status: 400 });
      }
      // 简单算法（16a）：复习一次 reviewCount+1，mastery 由前端传入（0-5），
      // lastReviewedAt=now，nextReviewAt = now + (mastery+1) 天（掌握度越高间隔越长）。
      const now = new Date();
      const masteryClamped = Math.max(0, Math.min(5, mastery ?? 0));
      const next = new Date(now.getTime() + (masteryClamped + 1) * 24 * 60 * 60 * 1000);
      const state = await db.articleReviewState.upsert({
        where: { userId_contentItemId: { userId: user.id, contentItemId } },
        create: {
          userId: user.id,
          contentItemId,
          mastery: masteryClamped,
          reviewCount: 1,
          lastReviewedAt: now,
          nextReviewAt: next,
        },
        update: {
          mastery: masteryClamped,
          reviewCount: { increment: 1 },
          lastReviewedAt: now,
          nextReviewAt: next,
        },
      });
      return NextResponse.json({ success: true, state });
    }

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
