import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { getFavoriteLimits, getCurrentFavoriteCount } from "@/lib/favorite-quota";

// GET /api/favorites — 当前用户的收藏列表
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  const items = await db.articleFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      contentItem: {
        select: { id: true, title: true, coverUrl: true, publishedAt: true, adminReviewStatus: true },
      },
    },
  });
  return NextResponse.json({ data: items });
}

// POST /api/favorites — 批量收藏
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { contentItemIds } = (await request.json()) as { contentItemIds: string[] };
    if (!Array.isArray(contentItemIds) || contentItemIds.length === 0) {
      return NextResponse.json({ error: "contentItemIds 不能为空" }, { status: 400 });
    }

    // 上限校验：整批超限 → 拒绝
    const limit = await getFavoriteLimits(user);
    const currentCount = await getCurrentFavoriteCount(user.id);
    if (currentCount + contentItemIds.length > limit) {
      return NextResponse.json(
        {
          error: `收藏已达上限（${currentCount}/${limit}），无法再加入 ${contentItemIds.length} 篇`,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // 只允许收藏 approved 文章
      const eligible = await tx.contentItem.findMany({
        where: { id: { in: contentItemIds }, adminReviewStatus: "approved" },
        select: { id: true },
      });
      const eligibleIds = eligible.map((e) => e.id);
      const skipped = contentItemIds.length - eligibleIds.length;

      let added = 0;
      for (const id of eligibleIds) {
        try {
          await tx.articleFavorite.create({ data: { userId: user.id, contentItemId: id } });
          added++;
        } catch {
          // 已收藏（unique 冲突）→ 跳过
        }
      }
      return { added, skipped, alreadyFavorited: eligibleIds.length - added };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("favorites POST failed:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}
