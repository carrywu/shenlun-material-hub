import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { getFavoriteLimits } from "@/lib/favorite-quota";

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

    const limit = await getFavoriteLimits(user);

    const result = await db.$transaction(async (tx) => {
      // P0-002: 事务级 advisory lock，串行化同一用户的配额检查
      // hashtext 返回 int4，pg_advisory_xact_lock 事务提交/回滚自动释放
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      // 事务内 count（修复 TOCTOU——读到的是串行化后的真实值）
      const currentCount = await tx.articleFavorite.count({
        where: { userId: user.id },
      });

      // 只允许收藏 approved 文章
      const eligible = await tx.contentItem.findMany({
        where: { id: { in: contentItemIds }, adminReviewStatus: "approved" },
        select: { id: true },
      });
      const eligibleIds = eligible.map((e) => e.id);
      const skipped = contentItemIds.length - eligibleIds.length;

      // 事务内配额检查（TOCTOU 修复的关键）
      if (currentCount + eligibleIds.length > limit) {
        throw new Error("QUOTA_EXCEEDED");
      }

      // 批量幂等插入（skipDuplicates 处理重复收藏）
      let added = 0;
      if (eligibleIds.length > 0) {
        const createResult = await tx.articleFavorite.createMany({
          data: eligibleIds.map((id) => ({ userId: user.id, contentItemId: id })),
          skipDuplicates: true,
        });
        added = createResult.count;
      }
      const alreadyFavorited = eligibleIds.length - added;
      return { added, skipped, alreadyFavorited };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        { error: "收藏已达上限，无法继续收藏" },
        { status: 400 }
      );
    }
    console.error("favorites POST failed:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}
