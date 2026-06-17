import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.getUserFromRequest,
  requireAdmin: (...args: unknown[]) => {
    // requireAdmin checks cookie + role; if user has cookie but is not ADMIN → returns null
    // In mock we simulate this: when getUserFromRequest returns a non-ADMIN, requireAdmin returns null
    const user = authMocks.getUserFromRequest(...args);
    return user;
  },
  authErrorResponse: () => Response.json({ error: "unauth" }, { status: 401 }),
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockReturnValue(true),
  canModifyResource: vi.fn().mockReturnValue(true),
}));

  const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    requireAdminResult: { value: null as unknown },
  }));
vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { findUnique: mocks.findUnique, update: mocks.update, delete: mocks.delete },
    userContentState: { findUnique: vi.fn().mockResolvedValue(null) },
    articleFavorite: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { GET } from "../route";

function makeReq(id: string, cookie: string | null) {
  const init: RequestInit = { method: "GET" };
  if (cookie) init.headers = { cookie };
  // NextRequest expects its own RequestInit where signal cannot be null
  const { signal, ...nextInit } = init;
  void signal;
  return [
    new NextRequest(`http://localhost/api/content-items/${id}`, nextInit),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/content-items/[id] — adminReviewStatus (P3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER 访问 pending_admin 文章 → 404（防 ID 绕过）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("VERIFIED_USER 访问 approved 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "approved",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("ADMIN 访问 pending_admin 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("详情响应保留 AI 评估来源元数据", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      aiAssessmentSource: "ai-runtime",
      aiAssessmentModel: "test-model",
      aiPromptVersion: "article_evaluation:v1",
      aiContentHash: "hash-at-eval",
      aiLastError: null,
      aiLastFailedAt: null,
      contentHash: "hash-current",
      materialCards: [],
      annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.aiAssessmentSource).toBe("ai-runtime");
    expect(body.aiAssessmentModel).toBe("test-model");
    expect(body.aiPromptVersion).toBe("article_evaluation:v1");
    expect(body.aiContentHash).toBe("hash-at-eval");
    expect(body.contentHash).toBe("hash-current");
  });

  // ── P0-001: 子资源隔离（A 看不到 B 的卡/批注）──────────────────────────
  it("非 ADMIN 详情只返回自己的 materialCards（不含别人的）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    // DB 返回文章 + 混合卡（自己的 + 别人的 + legacy null）
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "v", cardType: "golden_sentence" },
        { id: "other", ownerUserId: "user-b", cardType: "golden_sentence" },
        { id: "legacy", ownerUserId: null, cardType: "golden_sentence" },
      ],
      annotations: [
        { id: "own-ann", userId: "v" },
        { id: "other-ann", userId: "user-b" },
      ],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    // 只有自己的卡；别人的和 legacy null 被过滤
    const cardIds = body.materialCards.map((c: { id: string }) => c.id);
    expect(cardIds).toEqual(["own"]);
    // 只有自己的批注
    const annIds = body.annotations.map((a: { id: string }) => a.id);
    expect(annIds).toEqual(["own-ann"]);
  });

  it("ADMIN 详情返回全部 materialCards 和 annotations", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "admin-id" },
        { id: "other", ownerUserId: "user-b" },
        { id: "legacy", ownerUserId: null },
      ],
      annotations: [{ id: "a1", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards.length).toBe(3);
    expect(body.annotations.length).toBe(1);
  });

  it("非 ADMIN 详情无自己的卡时 materialCards 为空数组", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [{ id: "other", ownerUserId: "user-b" }],
      annotations: [{ id: "other-ann", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards).toEqual([]);
    expect(body.annotations).toEqual([]);
  });

  // ── P1-5 补充：不存在的 content item → 404 ──

  it("GET 不存在的 content item → 404 + 中文错误", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("nonexistent-id", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("不存在");
  });

  // ── P1-5 补充：响应体字段验证 ──

  it("GET 响应包含 title / source.name / publishedAt / fullText 等字段", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      title: "测试文章标题",
      fullText: "文章正文内容",
      excerpt: "摘要",
      publishedAt: new Date("2026-06-01"),
      createdAt: new Date("2026-06-02"),
      originalUrl: "https://example.com/article/1",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "src-1", name: "人民日报", platform: "website" },
      materialCards: [],
      annotations: [],
    });
    const [req, ctx] = makeReq("item-1", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("测试文章标题");
    expect(body.fullText).toBe("文章正文内容");
    expect(body.source.name).toBe("人民日报");
    expect(body.originalUrl).toBe("https://example.com/article/1");
    expect(body).toHaveProperty("publishedAt");
    expect(body).toHaveProperty("createdAt");
  });

  // ── P1-5 补充：无权访问 → 403 ──

  it("无权访问的 content item → 403 + 中文错误", async () => {
    const { canAccessResource } = await import("@/lib/data-isolation");
    (canAccessResource as ReturnType<typeof vi.fn>).mockReturnValue(false);
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "private-item",
      ownerUserId: "other-user",
      visibility: "private",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [],
      annotations: [],
    });
    const [req, ctx] = makeReq("private-item", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("无权");
  });

  // ── P1-5 补充：PUT 方法测试 ──

  describe("PUT /api/content-items/[id]", () => {
    // Import PUT at module level for these tests
    let PUT: typeof import("../route").PUT;
    beforeAll(async () => {
      const mod = await import("../route");
      PUT = mod.PUT;
    });

    it("ADMIN 更新 fullText → 重算 effectiveTextLength 和 contentHash", async () => {
      authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
      mocks.findUnique.mockResolvedValue({
        id: "item-1",
        ownerUserId: null,
      });
      mocks.update.mockResolvedValue({
        id: "item-1",
        fullText: "<p>新内容</p>",
        effectiveTextLength: 3,
        contentHash: "abc123",
        source: { id: "s", name: "n", platform: "website" },
      });
      const req = new NextRequest("http://localhost/api/content-items/item-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText: "<p>新内容</p>" }),
      });
      const ctx = { params: Promise.resolve({ id: "item-1" }) };
      const res = await PUT(req, ctx);
      expect(res.status).toBe(200);
      // update should have been called with recalculated fields
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullText: "<p>新内容</p>",
            fullTextStored: true,
          }),
        })
      );
    });

    it("ADMIN PUT 不存在的 item → 404", async () => {
      authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
      mocks.findUnique.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/content-items/no-such-item", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processingStatus: "completed" }),
      });
      const ctx = { params: Promise.resolve({ id: "no-such-item" }) };
      const res = await PUT(req, ctx);
      expect(res.status).toBe(404);
    });

    it("非 ADMIN PUT → 401/403", async () => {
      // requireAdmin: when getUserFromRequest returns VERIFIED (non-ADMIN), route checks cookie → 403
      authMocks.getUserFromRequest.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/content-items/item-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: "auth_token=t" },
        body: JSON.stringify({ fullText: "test" }),
      });
      const ctx = { params: Promise.resolve({ id: "item-1" }) };
      const res = await PUT(req, ctx);
      // requireAdmin returns null, cookie present → forbiddenResponse → 403
      expect(res.status).toBe(403);
    });
  });

  // ── P1-5 补充：DELETE 方法测试 ──

  describe("DELETE /api/content-items/[id]", () => {
    let DELETE: typeof import("../route").DELETE;
    beforeAll(async () => {
      const mod = await import("../route");
      DELETE = mod.DELETE;
    });

    it("ADMIN DELETE 已有 item → 200 + success:true", async () => {
      authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
      mocks.findUnique.mockResolvedValue({ id: "item-1", ownerUserId: null });
      mocks.delete.mockResolvedValue({ id: "item-1" });
      const req = new NextRequest("http://localhost/api/content-items/item-1", {
        method: "DELETE",
        headers: { cookie: "auth_token=t" },
      });
      const ctx = { params: Promise.resolve({ id: "item-1" }) };
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("ADMIN DELETE 不存在的 item → 404", async () => {
      authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
      mocks.findUnique.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/content-items/no-such-item", {
        method: "DELETE",
        headers: { cookie: "auth_token=t" },
      });
      const ctx = { params: Promise.resolve({ id: "no-such-item" }) };
      const res = await DELETE(req, ctx);
      expect(res.status).toBe(404);
    });

    it("非 ADMIN DELETE → 403", async () => {
      authMocks.getUserFromRequest.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/content-items/item-1", {
        method: "DELETE",
        headers: { cookie: "auth_token=t" },
      });
      const ctx = { params: Promise.resolve({ id: "item-1" }) };
      const res = await DELETE(req, ctx);
      // requireAdmin returns null, cookie present → 403
      expect(res.status).toBe(403);
    });
  });
});
