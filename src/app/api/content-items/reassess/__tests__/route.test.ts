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
    taskMocks.createAsyncTask.mockResolvedValue({ id: "task-1", type: "AI_ASSESS" });
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
});
