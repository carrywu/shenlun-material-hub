import { beforeEach, describe, expect, it, vi } from "vitest";

const quotaMock = vi.hoisted(() => ({ findUnique: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    roleQuota: { findUnique: quotaMock.findUnique },
    articleFavorite: { count: quotaMock.count },
  },
}));

import { getFavoriteLimits, getCurrentFavoriteCount } from "../favorite-quota";

describe("favorite-quota (P6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN → Infinity（不限）", async () => {
    const limit = await getFavoriteLimits({ role: "ADMIN" } as never);
    expect(limit).toBe(Infinity);
  });

  it("USER 查 RoleQuota 表，无记录 → 默认 100", async () => {
    quotaMock.findUnique.mockResolvedValue(null);
    const limit = await getFavoriteLimits({ role: "USER" } as never);
    expect(limit).toBe(100);
  });

  it("VERIFIED_USER 查表返 300", async () => {
    quotaMock.findUnique.mockResolvedValue({ role: "VERIFIED_USER", favoriteLimit: 300 });
    const limit = await getFavoriteLimits({ role: "VERIFIED_USER" } as never);
    expect(limit).toBe(300);
  });

  it("getCurrentFavoriteCount 查 articleFavorite.count", async () => {
    quotaMock.count.mockResolvedValue(7);
    const n = await getCurrentFavoriteCount("user-1");
    expect(n).toBe(7);
    expect(quotaMock.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
