import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: { VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const } },
  authMocks: { requireAuth: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const tx = vi.hoisted(() => ({ favDel: vi.fn(), cardDel: vi.fn() }));
const dbMock = {
  $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) =>
    fn({
      articleFavorite: { deleteMany: tx.favDel },
      materialCard: { deleteMany: tx.cardDel },
    })
  ),
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { DELETE } from "../route";

describe("DELETE /api/favorites/[id] (P6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("移除收藏 + 删该用户基于文章的卡", async () => {
    authMocks.requireAuth.mockResolvedValue(USERS.VERIFIED);
    const req = new NextRequest("http://localhost/api/favorites/c1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(tx.favDel).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "v", contentItemId: "c1" } })
    );
    expect(tx.cardDel).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: "v", contentItemId: "c1" } })
    );
  });

  it("未登录 → 401", async () => {
    authMocks.requireAuth.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/favorites/c1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(401);
  });
});
