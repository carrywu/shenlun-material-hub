import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * §P1-6 管理后台 — 来源管理 API 单元测试
 *
 * 覆盖 9 个 P1-6 场景：
 *   1. 添加来源 POST — 必填字段缺失→400 / 成功→201
 *   2. 编辑来源 PUT — 不存在→404 / 成功→200
 *   3. 删除/归档来源 DELETE — 不存在→404 / 成功→200+success
 *   4. 禁用来源 PUT isEnabled=false → 200
 *   5. sourceType 处理 — platform 过滤
 *   6. section/regionScopes 配置
 *   7. 批量导入重复 → skipped
 *   8. 批量导入无效数据 → errors
 *   9. USER 访问 → 403
 */

// ─── Shared mocks ───

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const USER = { id: "user-id", username: "user", role: "USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, USER },
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

// ─── Unified DB mock — all source operations share one mock ───

const sourceMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    source: {
      findMany: sourceMocks.findMany,
      count: sourceMocks.count,
      create: sourceMocks.create,
      findUnique: sourceMocks.findUnique,
      findFirst: sourceMocks.findFirst,
      update: sourceMocks.update,
    },
  },
}));

// ─── 1. POST /api/sources — 添加来源 ──

describe("POST /api/sources — P1-6 来源管理", () => {
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
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test", platform: "website", contentType: "article", trustLevel: "A" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("USER（cookie 在但 requireAdmin 返回 null）→ 403", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ name: "test", platform: "website", contentType: "article", trustLevel: "A" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("必填字段缺失 → 400 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ name: "test" }), // 缺 platform, contentType, trustLevel
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("必填字段");
  });

  it("创建成功 → 201 + 返回来源对象", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    sourceMocks.create.mockResolvedValue({
      id: "src-1",
      name: "人民日报",
      platform: "website",
      contentType: "article",
      trustLevel: "A",
      _count: { contentItems: 0 },
    });
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({
        name: "人民日报",
        platform: "website",
        contentType: "article",
        trustLevel: "A",
        regionScopes: ["全国"],
        keywords: ["评论"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("人民日报");
    expect(body.platform).toBe("website");
  });

  it("创建来源失败（DB 异常）→ 500 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    sourceMocks.create.mockRejectedValue(new Error("DB error"));
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ name: "test", platform: "website", contentType: "article", trustLevel: "A" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("创建来源失败");
  });
});

// ─── 2. GET /api/sources — 来源列表 ──

describe("GET /api/sources — P1-6 来源列表", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
  });

  it("成功返回分页列表", async () => {
    sourceMocks.findMany.mockResolvedValue([{ id: "s1", name: "来源1" }]);
    sourceMocks.count.mockResolvedValue(1);
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", { headers: { cookie: "auth_token=t" } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("platform 过滤 → where.platform 被设置", async () => {
    sourceMocks.findMany.mockResolvedValue([]);
    sourceMocks.count.mockResolvedValue(0);
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources?platform=wechat", { headers: { cookie: "auth_token=t" } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const where = sourceMocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.platform).toBe("wechat");
  });

  it("USER GET → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/sources", {
      headers: { cookie: "auth_token=t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

// ─── 3. GET/PUT/DELETE /api/sources/[id] — 单个来源 ──

describe("PUT /api/sources/[id] — P1-6 编辑来源", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
  });

  it("编辑不存在来源 → 404 + 中文错误", async () => {
    sourceMocks.findUnique.mockResolvedValue(null);
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/nonexistent", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ name: "新名称" }),
    });
    const ctx = { params: Promise.resolve({ id: "nonexistent" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("不存在");
  });

  it("编辑成功 → 200", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1", name: "旧名称" });
    sourceMocks.update.mockResolvedValue({ id: "s1", name: "新名称", _count: { contentItems: 5 } });
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ name: "新名称" }),
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("新名称");
  });

  // ── 4. 禁用来源 PUT isEnabled=false ──

  it("禁用来源 isEnabled=false → 200 + update 被调用", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1", name: "测试来源", isEnabled: true });
    sourceMocks.update.mockResolvedValue({ id: "s1", isEnabled: false, _count: { contentItems: 0 } });
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ isEnabled: false }),
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    expect(sourceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEnabled: false }),
      })
    );
  });

  // ── 5. sourceType/platform 处理 ──

  it("PUT 修改 platform → update data 包含 platform", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1", platform: "website" });
    sourceMocks.update.mockResolvedValue({ id: "s1", platform: "wechat", _count: { contentItems: 0 } });
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ platform: "wechat" }),
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    expect(sourceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ platform: "wechat" }),
      })
    );
  });

  // ── 6. section/regionScopes 配置 ──

  it("PUT 更新 regionScopes → JSON.stringify 被调用", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1" });
    sourceMocks.update.mockResolvedValue({ id: "s1", _count: { contentItems: 0 } });
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ regionScopes: ["全国", "省级"] }),
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    expect(sourceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          regionScopes: '["全国","省级"]',
        }),
      })
    );
  });

  it("PUT 更新 keywords → JSON.stringify 被调用", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1" });
    sourceMocks.update.mockResolvedValue({ id: "s1", _count: { contentItems: 0 } });
    const { PUT } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "PUT",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ keywords: ["评论", "社论"] }),
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    expect(sourceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keywords: '["评论","社论"]',
        }),
      })
    );
  });
});

// ── 3b. DELETE /api/sources/[id] — 删除/归档 ──

describe("DELETE /api/sources/[id] — P1-6 归档来源", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
  });

  it("删除不存在来源 → 404 + 中文错误", async () => {
    sourceMocks.findUnique.mockResolvedValue(null);
    const { DELETE } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/nonexistent", {
      method: "DELETE",
      headers: { cookie: "auth_token=t" },
    });
    const ctx = { params: Promise.resolve({ id: "nonexistent" }) };
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("不存在");
  });

  it("删除成功 → 200 + success:true + archivedAt 被设置（软删除）", async () => {
    sourceMocks.findUnique.mockResolvedValue({ id: "s1", name: "测试来源" });
    sourceMocks.update.mockResolvedValue({ id: "s1", archivedAt: new Date() });
    const { DELETE } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "DELETE",
      headers: { cookie: "auth_token=t" },
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 验证是软删除（设 archivedAt），不是硬删
    expect(sourceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ archivedAt: expect.any(Date) }),
      })
    );
  });

  it("USER DELETE → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const { DELETE } = await import("../[id]/route");
    const req = new NextRequest("http://localhost/api/sources/s1", {
      method: "DELETE",
      headers: { cookie: "auth_token=t" },
    });
    const ctx = { params: Promise.resolve({ id: "s1" }) };
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
  });
});

// ── 7. POST /api/sources/import — 批量导入 ──

describe("POST /api/sources/import — P1-6 批量导入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
  });

  it("空数组 → 400 + 中文错误", async () => {
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ sources: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("来源数组");
  });

  it("非数组 body → 400", async () => {
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify("not an array"),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("重复来源（externalId+platform 已存在）→ skipped", async () => {
    sourceMocks.findFirst.mockResolvedValue({ id: "existing-1" }); // 已存在
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({
        sources: [{
          name: "观潮的螃蟹",
          platform: "wechat",
          contentType: "article",
          trustLevel: "B",
          externalId: "mp-existing",
        }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.created).toBe(0);
  });

  it("新来源 → created=1", async () => {
    sourceMocks.findFirst.mockResolvedValue(null); // 不存在
    sourceMocks.create.mockResolvedValue({ id: "new-1" });
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({
        sources: [{
          name: "浙江宣传",
          platform: "wechat",
          contentType: "article",
          trustLevel: "A",
          externalId: "mp-new",
        }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.skipped).toBe(0);
  });

  // ── 8. 无效数据 → errors ──

  it("必填字段缺失 → errors 包含错误信息", async () => {
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({
        sources: [{
          name: "缺字段来源",
          // 缺 platform, contentType, trustLevel
        }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0]).toContain("缺少必填字段");
  });

  // ── 9. USER → 403 ──

  it("USER 批量导入 → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const { POST } = await import("../import/route");
    const req = new NextRequest("http://localhost/api/sources/import", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({
        sources: [{ name: "x", platform: "website", contentType: "article", trustLevel: "A" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
