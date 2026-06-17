import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * §P1-6 管理后台 — 文章审核 API + 推送 API 单元测试
 *
 * 补充现有 review route.test.ts 和 feature route.test.ts 未覆盖的 auth 和边界场景：
 *   - 空 ids → 400
 *   - ids 缺失 → 400
 *   - 未认证（无 cookie）→ 401
 *   - 已认证非 ADMIN（cookie 在）→ 403
 *   - 推送 feature: 未认证 → 401, 非 ADMIN → 403
 */

// ─── Shared mocks ───

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: {
      requireAdmin: vi.fn().mockResolvedValue(null),
      unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
      forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
}));

// ─── Review route DB mock ───

const { tx, reviewDbMock } = vi.hoisted(() => {
  const tx = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const reviewDbMock = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) =>
      fn({
        contentItem: { findMany: tx.findMany, updateMany: tx.updateMany },
        materialCard: { deleteMany: tx.deleteMany },
      })
    ),
    contentItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { tx, reviewDbMock };
});

vi.mock("@/lib/db", () => ({ db: reviewDbMock }));
vi.mock("@/lib/audit-logger", () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

// ─── Review route tests ───

describe("POST /api/admin/content-items/review — P1-6 auth + 边界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    authMocks.forbiddenResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
  });

  it("未认证（无 cookie）→ 401", async () => {
    const { POST } = await import("../../review/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: ["x"], action: "approve" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("已认证非 ADMIN（cookie 在但 requireAdmin 返回 null）→ 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const { POST } = await import("../../review/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/review", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ ids: ["x"], action: "approve" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("空 ids 数组 → 400 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const { POST } = await import("../../review/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/review", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ ids: [], action: "approve" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不能为空");
  });

  it("ids 缺失 → 400 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const { POST } = await import("../../review/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/review", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不能为空");
  });
});

// ─── Feature route tests ───

describe("POST /api/admin/content-items/feature — P1-6 auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    authMocks.forbiddenResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
  });

  it("未认证（无 cookie）→ 401", async () => {
    const { POST } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("已认证非 ADMIN → 403", async () => {
    const { POST } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ id: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("id 缺失 → 400 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const { POST } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id");
  });

  it("文章不存在 → 404", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    reviewDbMock.contentItem.findUnique.mockResolvedValue(null);
    const { POST } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ id: "nonexistent" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/content-items/feature — P1-6 auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    authMocks.forbiddenResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
  });

  it("未认证 → 401", async () => {
    const { DELETE } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature?id=x", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("非 ADMIN → 403", async () => {
    const { DELETE } = await import("../../feature/route");
    const req = new NextRequest("http://localhost/api/admin/content-items/feature?id=x", {
      method: "DELETE",
      headers: { cookie: "auth_token=t" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });
});
