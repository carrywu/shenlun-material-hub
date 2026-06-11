import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";

const DEFAULTS: Record<string, number> = {
  USER: 100,
  VERIFIED_USER: 300,
};

/** 返回某角色的收藏上限。ADMIN 返 Infinity（不限）。表无记录用 DEFAULTS 兜底。 */
export async function getFavoriteLimits(user: Pick<AuthUser, "role">): Promise<number> {
  if (user.role === "ADMIN") return Infinity;
  const row = await db.roleQuota.findUnique({
    where: { role: user.role },
    select: { favoriteLimit: true },
  });
  return row?.favoriteLimit ?? DEFAULTS[user.role] ?? 100;
}

/** 返回某用户已收藏数量。 */
export async function getCurrentFavoriteCount(userId: string): Promise<number> {
  return db.articleFavorite.count({ where: { userId } });
}
