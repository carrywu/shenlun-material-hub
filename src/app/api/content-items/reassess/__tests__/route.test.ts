import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "verified-id", username: "verified", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  const currentUser = { value: null as typeof ADMIN | typeof VERIFIED | null };
  const requireAdmin = vi.fn(async () => {
    const u = currentUser.value;
    if (!u) return null;
    return u.role === "ADMIN" ? u : null;
  });
  const requireVerifiedUser = vi.fn(async () => {
    const u = currentUser.value;
    if (!u) return null;
    return u.role === "ADMIN" || u.role === "VERIFIED_USER" ? u : null;
  });
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { currentUser, requireAdmin, requireVerifiedUser },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  requireVerifiedUser: authMocks.requireVerifiedUser,
  unauthorizedResponse: () => Response.json({ error: "未登录或会话已过期" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "权限不足" }, { status: 403 }),
}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: dbMocks.findUnique,
      update: dbMocks.update,
    },
  },
}));

const aiMocks = vi.hoisted(() => ({
  assessRelevanceWithRetry: vi.fn(),
  scoreContentItem: vi.fn(),
}));

vi.mock("@/services/ai", () => {
  class AiServiceError extends Error {
    code: string;
    status?: number;

    constructor(code: string, message: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  return {
    AiServiceError,
    assessRelevanceWithRetry: aiMocks.assessRelevanceWithRetry,
    scoreContentItem: aiMocks.scoreContentItem,
  };
});

const taskMocks = vi.hoisted(() => ({
  createAsyncTask: vi.fn(),
  completeAsyncTask: vi.fn(),
}));

vi.mock("@/lib/async-task", () => ({
  createAsyncTask: taskMocks.createAsyncTask,
  completeAsyncTask: taskMocks.completeAsyncTask,
}));

import { POST } from "../route";

function makeReq(cookie: string | null, body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const { signal, ...nextInit } = init;
  void signal;
  return new NextRequest("http://localhost/api/content-items/reassess", nextInit);
}

const ARTICLE = {
  id: "article-1",
  title: "测试文章",
  contentType: "policy_analysis",
  fullText: "这是一篇用于重新评估的测试文章。".repeat(40),
  excerpt: null,
  source: { name: "测试来源" },
  aiDecision: "accept",
  aiReason: "旧理由",
  aiSummary: "旧摘要",
  aiAssessedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("POST /api/content-items/reassess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.currentUser.value = null;
    dbMocks.findUnique.mockResolvedValue(ARTICLE);
    dbMocks.update.mockResolvedValue({ ...ARTICLE, id: "article-1" });
    taskMocks.createAsyncTask.mockResolvedValue({ id: "task-1", type: "AI_ASSESS" });
    taskMocks.completeAsyncTask.mockResolvedValue(undefined);
  });

  it("rejects verified users because reassessment changes public AI fields", async () => {
    authMocks.currentUser.value = USERS.VERIFIED;

    const res = await POST(makeReq("auth_token=t", { id: "article-1" }));

    expect(res.status).toBe(403);
    expect(dbMocks.findUnique).not.toHaveBeenCalled();
    expect(aiMocks.assessRelevanceWithRetry).not.toHaveBeenCalled();
  });

  it("preserves old AI evaluation and records latest error when reassessment fails", async () => {
    authMocks.currentUser.value = USERS.ADMIN;
    aiMocks.assessRelevanceWithRetry.mockRejectedValue(new Error("供应商超时"));

    const res = await POST(makeReq("auth_token=t", { id: "article-1" }));

    expect(res.status).toBe(500);
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: expect.objectContaining({
        aiLastError: "供应商超时",
        aiLastFailedAt: expect.any(Date),
      }),
    });
    expect(dbMocks.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiDecision: null,
          aiReason: null,
          aiSummary: null,
        }),
      })
    );
  });

  it("writes adminReviewStatus and auto-scores on accept", async () => {
    authMocks.currentUser.value = USERS.ADMIN;
    aiMocks.assessRelevanceWithRetry.mockResolvedValue({
      decision: "accept",
      reason: "高质量素材",
      contentGenre: "policy_interpretation",
      categories: ["治理"],
      usableFor: ["申论"],
      summary: "摘要",
      quotes: ["金句"],
    });
    aiMocks.scoreContentItem.mockResolvedValue({
      overall: 8.5,
      detail: { relevance: 9, quality: 8, freshness: 8, uniqueness: 7, usability: 10 },
    });

    const res = await POST(makeReq("auth_token=t", { id: "article-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // 自动评分应被触发
    expect(aiMocks.scoreContentItem).toHaveBeenCalledTimes(1);
    // update 写入应包含评分字段
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: expect.objectContaining({
        aiScore: 8.5,
        aiScoreDetail: expect.any(String),
        aiScoredAt: expect.any(Date),
        // 与 assess 接口一致：accept 时审核状态置为 pending_admin
        adminReviewStatus: "pending_admin",
        aiDecision: "accept",
      }),
    });
  });

  it("does not auto-score when rejected and clears old score", async () => {
    authMocks.currentUser.value = USERS.ADMIN;
    aiMocks.assessRelevanceWithRetry.mockResolvedValue({
      decision: "reject",
      reason: "不相关",
      contentGenre: null,
      categories: [],
      usableFor: [],
      summary: null,
      quotes: [],
    });

    const res = await POST(makeReq("auth_token=t", { id: "article-1" }));

    expect(res.status).toBe(200);
    // reject 不应触发评分
    expect(aiMocks.scoreContentItem).not.toHaveBeenCalled();
    // 旧评分应被清空
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: expect.objectContaining({
        aiScore: null,
        aiScoreDetail: null,
        aiScoredAt: null,
        adminReviewStatus: "rejected",
        aiDecision: "reject",
      }),
    });
  });

  it("keeps evaluation result when auto-scoring fails", async () => {
    authMocks.currentUser.value = USERS.ADMIN;
    aiMocks.assessRelevanceWithRetry.mockResolvedValue({
      decision: "accept",
      reason: "高质量素材",
      contentGenre: "policy_interpretation",
      categories: ["治理"],
      usableFor: ["申论"],
      summary: "摘要",
      quotes: ["金句"],
    });
    aiMocks.scoreContentItem.mockRejectedValue(new Error("评分服务超时"));

    const res = await POST(makeReq("auth_token=t", { id: "article-1" }));

    // 评估仍应成功（评分失败不阻断）
    expect(res.status).toBe(200);
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: expect.objectContaining({
        aiDecision: "accept",
        // 评分失败时三个字段为 null
        aiScore: null,
        aiScoreDetail: null,
        aiScoredAt: null,
      }),
    });
  });
});
