import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireVerifiedUser: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireAuth: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  validateSession: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  hashPassword: vi.fn().mockResolvedValue("$2a$12$hash"),
  verifyPassword: vi.fn().mockResolvedValue({ valid: true }),
  createSession: vi.fn().mockResolvedValue("test-token"),
  ensureInitialAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  createAsyncTask: vi.fn(),
  enqueueAsyncTask: vi.fn(),
  checkTaskRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
    },
    materialCard: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/async-task", () => ({
  createAsyncTask: mocks.createAsyncTask,
  enqueueAsyncTask: mocks.enqueueAsyncTask,
  checkTaskRateLimit: mocks.checkTaskRateLimit,
}));

describe("POST /api/content-items/[id]/generate-card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireVerifiedUser.mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" });
    mocks.findUnique.mockResolvedValue({
      id: "article-1",
      title: "测试文章",
      fullText: "正文",
      aiDecision: "accept",
      aiReason: null,
      ownerUserId: "test-admin",
      visibility: "private",
      source: { name: "来源" },
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.checkTaskRateLimit.mockResolvedValue({ allowed: true });
    mocks.createAsyncTask.mockResolvedValue({ id: "task-1", type: "CARD_GENERATE" });
  });

  it("queues background generation and returns 202", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      accepted: true,
      taskId: "task-1",
      status: "PENDING",
      contentItemId: "article-1",
      cardType: "golden_sentence",
    });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { contentItemId: "article-1", cardType: "golden_sentence", ownerUserId: "test-admin" },
    });
    expect(mocks.checkTaskRateLimit).toHaveBeenCalledWith("test-admin");
    expect(mocks.createAsyncTask).toHaveBeenCalledWith(
      "CARD_GENERATE",
      expect.objectContaining({
        contentItemId: "article-1",
        cardType: "golden_sentence",
      }),
      "test-admin"
    );
    expect(mocks.enqueueAsyncTask).toHaveBeenCalledTimes(1);
  });

  it("returns a clear error when full text is missing", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "article-1",
      title: "测试文章",
      fullText: null,
      aiDecision: "accept",
      aiReason: null,
      ownerUserId: "test-admin",
      visibility: "private",
      source: { name: "来源" },
    });
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "NO_FULL_TEXT", message: "该内容条目没有全文，无法生成素材卡" });
  });

  it("rejects private content owned by another user", async () => {
    authMocks.requireVerifiedUser.mockResolvedValueOnce({ id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" });
    mocks.findUnique.mockResolvedValueOnce({
      id: "article-1",
      title: "测试文章",
      fullText: "正文",
      aiDecision: "accept",
      aiReason: null,
      ownerUserId: "user-2",
      visibility: "private",
      source: { name: "来源" },
    });
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "CONTENT_ITEM_FORBIDDEN", message: "无权为该内容生成素材卡" });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.createAsyncTask).not.toHaveBeenCalled();
    expect(mocks.enqueueAsyncTask).not.toHaveBeenCalled();
  });

  it("allows verified users to generate from public content", async () => {
    authMocks.requireVerifiedUser.mockResolvedValueOnce({ id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" });
    mocks.findUnique.mockResolvedValueOnce({
      id: "article-1",
      title: "测试文章",
      fullText: "正文",
      aiDecision: "accept",
      aiReason: null,
      ownerUserId: "user-2",
      visibility: "public",
      source: { name: "来源" },
    });
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );

    expect(response.status).toBe(202);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { contentItemId: "article-1", cardType: "golden_sentence", ownerUserId: "user-1" },
    });
    expect(mocks.createAsyncTask).toHaveBeenCalledWith(
      "CARD_GENERATE",
      expect.objectContaining({ contentItemId: "article-1", cardType: "golden_sentence" }),
      "user-1"
    );
  });

  it("returns 429 and does not enqueue when task rate limit is exceeded", async () => {
    mocks.checkTaskRateLimit.mockResolvedValueOnce({ allowed: false, reason: "并发任务数已达上限 (3)" });
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({ error: "TASK_RATE_LIMITED", message: "并发任务数已达上限 (3)" });
    expect(mocks.createAsyncTask).not.toHaveBeenCalled();
    expect(mocks.enqueueAsyncTask).not.toHaveBeenCalled();
  });

  it("uses owner-scoped duplicate checks", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "card-1" });
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: "MATERIAL_CARD_ALREADY_EXISTS", existingCardId: "card-1" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { contentItemId: "article-1", cardType: "golden_sentence", ownerUserId: "test-admin" },
    });
    expect(mocks.createAsyncTask).not.toHaveBeenCalled();
  });

  it("rejects data_fact as a new material card type", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "data_fact" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("无效的卡片类型");
    expect(payload.message).not.toContain("data_fact");
    expect(mocks.enqueueAsyncTask).not.toHaveBeenCalled();
  });
});
