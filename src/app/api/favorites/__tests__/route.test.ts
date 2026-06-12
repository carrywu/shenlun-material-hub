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

const quota = vi.hoisted(() => ({ limits: vi.fn() }));
vi.mock("@/lib/favorite-quota", () => ({
  getFavoriteLimits: quota.limits,
}));

const { mocks, dbMock } = vi.hoisted(() => {
  const mocks = {
    txFindMany: vi.fn(),
    txCreate: vi.fn(),
    txCount: vi.fn().mockResolvedValue(0),
    txCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
    txExecuteRaw: vi.fn().mockResolvedValue(1),
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const dbMock = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        contentItem: { findMany: mocks.txFindMany },
        articleFavorite: {
          create: mocks.txCreate,
          count: mocks.txCount,
          createMany: mocks.txCreateMany,
        },
        $executeRaw: mocks.txExecuteRaw,
      })
    ),
    articleFavorite: { count: mocks.count, findMany: mocks.findMany },
  };
  return { mocks, dbMock };
});
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET, POST } from "../route";

function makeReq(method: string, user: unknown | null, body?: unknown) {
  authMocks.requireAuth.mockResolvedValue(user);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  // NextRequest expects its own RequestInit where signal cannot be null
  const { signal, ...nextInit } = init;
  void signal;
  return new NextRequest("http://localhost/api/favorites", nextInit);
}

describe("favorites route (P6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quota.limits.mockResolvedValue(100);
  });

  it("USER 可收藏（不限角色）", async () => {
    mocks.txFindMany.mockResolvedValue([{ id: "c1", adminReviewStatus: "approved" }]);
    mocks.txCreateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeReq("POST", USERS.USER, { contentItemIds: ["c1"] }));
    expect(res.status).toBe(200);
  });

  it("整批超上限 → 400（不部分收藏）", async () => {
    quota.limits.mockResolvedValue(100);
    mocks.txCount.mockResolvedValue(95);
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    mocks.txFindMany.mockResolvedValue(ids.map((id) => ({ id })));
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ids }));
    expect(res.status).toBe(400);
    expect(mocks.txCreateMany).not.toHaveBeenCalled();
  });

  it("未审核文章被过滤（skipped）", async () => {
    // 模拟 Prisma findMany 尊重 where.adminReviewStatus 过滤
    const rows = [
      { id: "c1", adminReviewStatus: "approved" },
      { id: "c2", adminReviewStatus: "pending_admin" },
    ];
    mocks.txFindMany.mockImplementation(async (args: { where?: { adminReviewStatus?: string } }) => {
      const status = args?.where?.adminReviewStatus;
      return status ? rows.filter((r) => r.adminReviewStatus === status) : rows;
    });
    mocks.txCount.mockResolvedValue(0);
    mocks.txCreateMany.mockResolvedValue({ count: 1 });
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

  // ── P0-002: 收藏配额 TOCTOU 修复（advisory lock + 事务内 count）────────
  it("P0-002: 事务内调 advisory lock（$executeRaw 调 pg_advisory_xact_lock）", async () => {
    mocks.txFindMany.mockResolvedValue([{ id: "c1" }]);
    mocks.txCount.mockResolvedValue(0);
    mocks.txCreateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ["c1"] }));
    expect(res.status).toBe(200);
    // 关键：$transaction 内执行了 advisory lock raw SQL
    expect(mocks.txExecuteRaw).toHaveBeenCalled();
    const rawCall = mocks.txExecuteRaw.mock.calls[0];
    // $executeRaw tagged template 把 SQL 字符串作为第一个元素
    const sqlString =
      typeof rawCall?.[0] === "string"
        ? rawCall[0]
        : JSON.stringify(rawCall?.[0] ?? "");
    expect(sqlString).toContain("pg_advisory_xact_lock");
  });

  it("P0-002: 事务内 count 检查超限 → 400（不 createMany）", async () => {
    mocks.txFindMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    mocks.txCount.mockResolvedValue(99); // 已有 99，名额剩 1，但申请 2 篇
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ["c1", "c2"] }));
    expect(res.status).toBe(400);
    expect(mocks.txCreateMany).not.toHaveBeenCalled();
  });
});
