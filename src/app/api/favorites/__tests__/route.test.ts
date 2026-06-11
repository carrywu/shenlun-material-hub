import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
    USER: { id: "u", username: "u", role: "USER" as const, status: "ACTIVE" as const },
  },
  authMocks: { requireAuth: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const quota = vi.hoisted(() => ({ limits: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/favorite-quota", () => ({
  getFavoriteLimits: quota.limits,
  getCurrentFavoriteCount: quota.count,
}));

const mocks = vi.hoisted(() => ({
  txFindMany: vi.fn(),
  txCreate: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));
const dbMock = {
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      contentItem: { findMany: mocks.txFindMany },
      articleFavorite: { create: mocks.txCreate },
    })
  ),
  articleFavorite: { count: mocks.count, findMany: mocks.findMany },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET, POST } from "../route";

function makeReq(method: string, user: unknown | null, body?: unknown) {
  authMocks.requireAuth.mockResolvedValue(user);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/favorites", init);
}

describe("favorites route (P6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quota.limits.mockResolvedValue(100);
    quota.count.mockResolvedValue(0);
  });

  it("USER 可收藏（不限角色）", async () => {
    mocks.txFindMany.mockResolvedValue([{ id: "c1", adminReviewStatus: "approved" }]);
    mocks.txCreate.mockResolvedValue({});
    const res = await POST(makeReq("POST", USERS.USER, { contentItemIds: ["c1"] }));
    expect(res.status).toBe(200);
  });

  it("整批超上限 → 400（不部分收藏）", async () => {
    quota.limits.mockResolvedValue(100);
    quota.count.mockResolvedValue(95);
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ids }));
    expect(res.status).toBe(400);
    expect(mocks.txCreate).not.toHaveBeenCalled();
  });

  it("未审核文章被过滤（skipped）", async () => {
    mocks.txFindMany.mockResolvedValue([
      { id: "c1", adminReviewStatus: "approved" },
      { id: "c2", adminReviewStatus: "pending_admin" },
    ]);
    mocks.txCreate.mockResolvedValue({});
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ["c1", "c2"] }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.added).toBe(1);
    expect(j.skipped).toBe(1);
  });

  it("GET 返回当前用户收藏列表", async () => {
    mocks.findMany.mockResolvedValue([
      { userId: "v", contentItemId: "c1", contentItem: { id: "c1", title: "t" } },
    ]);
    const res = await GET(makeReq("GET", USERS.VERIFIED));
    expect(res.status).toBe(200);
  });

  it("未登录 → 401", async () => {
    authMocks.requireAuth.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/favorites", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
