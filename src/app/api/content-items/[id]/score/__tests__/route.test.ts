import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * §P1-5 AI 评分 Route 测试
 * 覆盖 POST + GET /api/content-items/[id]/score
 */

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-1", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const USER = { id: "user-1", username: "user", role: "USER" as const, status: "ACTIVE" as const };
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

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  scoreContentItem: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock("@/services/ai", () => ({
  scoreContentItem: mocks.scoreContentItem,
  AiServiceError: class AiServiceError extends Error {
    code: string;
    status?: number;
    constructor(message: string, code: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

function makeReq(method: string, id: string, body?: unknown) {
  const init: RequestInit = { method, headers: { cookie: "auth_token=t" } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return [
    new NextRequest(`http://localhost/api/content-items/${id}/score`, init),
    { params: Promise.resolve({ id }) },
  ] as const;
}

// ── POST /api/content-items/[id]/score ──

describe("POST /api/content-items/[id]/score", () => {
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
    authMocks.requireAdmin.mockResolvedValue(null);
    // No cookie → unauthorizedResponse
    authMocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/content-items/item-1/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const ctx = { params: Promise.resolve({ id: "item-1" }) };
    const { POST } = await import("../route");
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("非 ADMIN（cookie 在但 requireAdmin 返回 null）→ 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    // Cookie present → forbiddenResponse
    const { POST } = await import("../route");
    const [req, ctx] = makeReq("POST", "item-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("ADMIN 评分成功 → 200 + aiScore/aiScoreDetail/aiScoredAt", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      title: "测试文章",
      fullText: "文章内容正文足够长",
      excerpt: "摘要",
      contentType: "article",
      source: { name: "人民日报" },
    });
    mocks.scoreContentItem.mockResolvedValue({
      overall: 85,
      detail: { relevance: 90, depth: 80, originality: 85 },
    });
    mocks.update.mockResolvedValue({
      id: "item-1",
      aiScore: 85,
      aiScoreDetail: '{"relevance":90,"depth":80,"originality":85}',
      aiScoredAt: new Date("2026-06-17"),
    });

    const { POST } = await import("../route");
    const [req, ctx] = makeReq("POST", "item-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.aiScore).toBe(85);
    expect(body.aiScoreDetail).toEqual({ relevance: 90, depth: 80, originality: 85 });
    expect(body).toHaveProperty("aiScoredAt");
  });

  it("不存在的 item → 404 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue(null);

    const { POST } = await import("../route");
    const [req, ctx] = makeReq("POST", "nonexistent", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("不存在");
  });

  it("fullText 和 excerpt 都为空 → 400 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      title: "测试文章",
      fullText: null,
      excerpt: null,
      contentType: "article",
      source: { name: "人民日报" },
    });

    const { POST } = await import("../route");
    const [req, ctx] = makeReq("POST", "item-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("全文或摘要");
  });

  it("AiServiceError → 500 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      title: "测试文章",
      fullText: "文章内容",
      contentType: "article",
      source: { name: "人民日报" },
    });

    const { AiServiceError } = await import("@/services/ai");
    const aiErr = new AiServiceError("AI 服务调用失败", "AI_API_ERROR", 500);
    mocks.scoreContentItem.mockRejectedValue(aiErr);

    const { POST } = await import("../route");
    const [req, ctx] = makeReq("POST", "item-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("AI");
  });
});

// ── GET /api/content-items/[id]/score ──

describe("GET /api/content-items/[id]/score", () => {
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
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/content-items/item-1/score", {
      method: "GET",
    });
    const ctx = { params: Promise.resolve({ id: "item-1" }) };
    const { GET } = await import("../route");
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("非 ADMIN（cookie 在但 requireAdmin 返回 null）→ 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const { GET } = await import("../route");
    const [req, ctx] = makeReq("GET", "item-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("ADMIN 获取评分 → 200 + 解析 aiScoreDetail JSON", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      aiScore: 90,
      aiScoreDetail: '{"relevance":92,"depth":88,"originality":90}',
      aiScoredAt: new Date("2026-06-17"),
    });

    const { GET } = await import("../route");
    const [req, ctx] = makeReq("GET", "item-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.aiScore).toBe(90);
    // aiScoreDetail should be parsed from JSON string to object
    expect(body.aiScoreDetail).toEqual({ relevance: 92, depth: 88, originality: 90 });
  });

  it("不存在的 item → 404 + 中文错误", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue(null);

    const { GET } = await import("../route");
    const [req, ctx] = makeReq("GET", "nonexistent");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("不存在");
  });

  it("item 未评分 → aiScoreDetail 为 null", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "item-1",
      aiScore: null,
      aiScoreDetail: null,
      aiScoredAt: null,
    });

    const { GET } = await import("../route");
    const [req, ctx] = makeReq("GET", "item-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.aiScore).toBeNull();
    expect(body.aiScoreDetail).toBeNull();
    expect(body.aiScoredAt).toBeNull();
  });
});
