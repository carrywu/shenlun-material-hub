import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
    USER: { id: "u", username: "u", role: "USER" as const, status: "ACTIVE" as const },
    VERIFIED_B: { id: "vb", username: "vb", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
  },
  authMocks: {
    requireVerifiedUser: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: authMocks.requireVerifiedUser,
  unauthorizedResponse: () => Response.json({ error: "未登录或会话已过期", code: "UNAUTHORIZED", status: 401 }, { status: 401 }),
  forbiddenResponse: (m?: string) => Response.json({ error: m ?? "权限不足", code: "FORBIDDEN", status: 403 }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirstCard: vi.fn(),
  createTask: vi.fn(),
  enqueue: vi.fn(),
  update: vi.fn(),
}));

const aiMock = vi.hoisted(() => ({
  AiServiceError: class extends Error {
    code: string;
    status: number;
    diagnostics?: unknown;
    constructor(code: string, message: string, status = 500, diagnostics?: unknown) {
      super(message);
      this.name = "AiServiceError";
      this.code = code;
      this.status = status;
      this.diagnostics = diagnostics;
    }
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { findUnique: mocks.findUnique, update: mocks.update },
    materialCard: { findFirst: mocks.findFirstCard },
  },
}));

vi.mock("@/lib/async-task", () => ({
  createDedupTask: mocks.createTask,
  enqueueAsyncTask: mocks.enqueue,
  RateLimitError: class RateLimitError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = "RateLimitError";
      this.reason = reason;
    }
  },
}));

vi.mock("@/services/ai", () => ({
  generateCardForContentItem: vi.fn(),
  AiServiceError: aiMock.AiServiceError,
}));

import { POST } from "../route";

function makeReq(id: string, user: unknown, body: unknown, cookie?: string) {
  authMocks.requireVerifiedUser.mockResolvedValue(user);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  const init: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };
  const { signal, ...nextInit } = init;
  void signal;
  return [
    new NextRequest(`http://localhost/api/content-items/${id}/generate-card`, nextInit),
    { params: Promise.resolve({ id }) },
  ] as const;
}

const APPROVED_ITEM = {
  id: "x",
  fullText: "内容".repeat(200),
  aiDecision: "accept",
  adminReviewStatus: "approved",
  source: { name: "src" },
  title: "标题",
};

describe("POST /api/content-items/[id]/generate-card — P0-4 (GC-001~GC-020)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── GC-001: anonymous → 401 ───

  it("GC-001: anonymous（无 cookie）→ 401", async () => {
    const [req, ctx] = makeReq("x", null, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  // ─── GC-002: USER → 403 + 中文错误 ───

  it("GC-002: USER → 403 + 中文错误信息", async () => {
    const [req, ctx] = makeReq("x", USERS.USER, { cardType: "golden_sentence" }, "auth_token=abc");
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("普通用户");
  });

  // ─── GC-003: VERIFIED_USER → 202 ───

  it("GC-003: VERIFIED_USER 生成单张 golden_sentence → 202", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.requestId).toMatch(/^gen_/);
    expect(body.tasks[0].cardType).toBe("golden_sentence");
    expect(body.tasks[0].duplicated).toBe(false);
  });

  // ─── GC-004: ADMIN → 202 ───

  it("GC-004: ADMIN 生成单张 golden_sentence → 202", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.ADMIN, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.requestId).toMatch(/^gen_/);
    expect(body.tasks[0].cardType).toBe("golden_sentence");
  });

  // ─── GC-005: 文章不存在 → 404 ───

  it("GC-005: 文章不存在 → 404 + CONTENT_ITEM_NOT_FOUND", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("nonexistent", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("CONTENT_ITEM_NOT_FOUND");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-006: 文章无 fullText → 400 ───

  it("GC-006: 文章无 fullText → 400 + NO_FULL_TEXT", async () => {
    mocks.findUnique.mockResolvedValue({ ...APPROVED_ITEM, fullText: null });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("NO_FULL_TEXT");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-007: 文章未 approved → 400 ───

  it("GC-007: 文章未 approved → 400 + NOT_APPROVED + requestId", async () => {
    mocks.findUnique.mockResolvedValue({ ...APPROVED_ITEM, adminReviewStatus: "pending_admin" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("NOT_APPROVED");
    expect(body.message).toContain("审核");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-008: 非法 cardType → 400 ───

  it("GC-008: 非法 cardType → 400 + AI_RESPONSE_INVALID_JSON", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "invalid_type" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("AI_RESPONSE_INVALID_JSON");
    expect(body.message).toContain("无效");
    expect(body.requestId).toBeTruthy();
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  // ─── GC-009: 同用户同类型已存在 → 409 ───

  it("GC-009: 同用户同类型已存在 → 409 + MATERIAL_CARD_ALREADY_EXISTS", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "existing", ownerUserId: "v" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("MATERIAL_CARD_ALREADY_EXISTS");
    expect(body.existingCardId).toBe("existing");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-010: force=true 重新生成 → 202 ───

  it("GC-010: force=true 重新生成 → 202 + createTask 入队", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "existing", ownerUserId: "v" });
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence", force: true });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it("GC-010b: force=false (默认) 同类型已存在 → 409", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "existing", ownerUserId: "v" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence", force: false });
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  // ─── GC-011: 卡包模式 → 202，返回多个 tasks ───

  it("GC-011: 卡包模式 cardTypes 数组 → 202 + 多任务", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, {
      cardTypes: ["golden_sentence", "standard_expression", "case_material", "countermeasure"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.tasks).toHaveLength(4);
    expect(body.tasks.map((t: { cardType: string }) => t.cardType)).toEqual([
      "golden_sentence", "standard_expression", "case_material", "countermeasure",
    ]);
    expect(mocks.createTask).toHaveBeenCalledTimes(4);
  });

  // ─── GC-012: 卡包模式部分已存在 → 202, duplicated=true ───

  it("GC-012: 卡包模式部分已存在 → 202 + duplicated 标记", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard
      .mockResolvedValueOnce({ id: "card-gs", ownerUserId: "v" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, {
      cardTypes: ["golden_sentence", "standard_expression", "case_material"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.tasks).toHaveLength(3);
    const gsTask = body.tasks.find((t: { cardType: string }) => t.cardType === "golden_sentence");
    expect(gsTask.duplicated).toBe(true);
    expect(gsTask.existingCardId).toBe("card-gs");
    const seTask = body.tasks.find((t: { cardType: string }) => t.cardType === "standard_expression");
    expect(seTask.duplicated).toBe(false);
    expect(mocks.createTask).toHaveBeenCalledTimes(2);
  });

  // ─── GC-013: 单类型限流 → 429 ───

  it("GC-013: 单类型限流 → 429 + RATE_LIMITED", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const { RateLimitError } = await import("@/lib/async-task");
    mocks.createTask.mockRejectedValue(new RateLimitError("并发上限"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-014: 卡包模式部分限流 → 202 + rateLimited=true ───

  it("GC-014: 卡包模式部分限流 → 202 + 已接受任务 + rateLimited", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const { RateLimitError } = await import("@/lib/async-task");
    mocks.createTask
      .mockResolvedValueOnce({ id: "t1", type: "CARD_GENERATE" })
      .mockResolvedValueOnce({ id: "t2", type: "CARD_GENERATE" })
      .mockResolvedValueOnce({ id: "t3", type: "CARD_GENERATE" })
      .mockRejectedValueOnce(new RateLimitError("并发上限"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, {
      cardTypes: ["golden_sentence", "standard_expression", "case_material", "countermeasure"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.rateLimited).toBe(true);
    expect(body.rateLimitReason).toBe("并发上限");
    expect(body.tasks).toHaveLength(3);
    expect(mocks.createTask).toHaveBeenCalledTimes(4);
  });

  // ─── GC-015: createDedupTask 抛错（非 RateLimitError）→ 500 ───

  it("GC-015: createDedupTask 抛 DB Error → 500 + AI_API_CALL_FAILED", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockRejectedValue(new Error("数据库连接失败"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("AI_API_CALL_FAILED");
    expect(body.message).toContain("数据库连接失败");
    expect(body.requestId).toBeTruthy();
  });

  // ─── GC-016: AiServiceError → 对应 code/status ───

  it("GC-016: AiServiceError → 保留原始 code + status", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const aiErr = new aiMock.AiServiceError("AI_CONFIG_MISSING", "AI 配置缺失", 500);
    mocks.createTask.mockRejectedValue(aiErr);
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("AI_CONFIG_MISSING");
    expect(body.message).toContain("AI 配置缺失");
    expect(body.requestId).toBeTruthy();
  });

  it("GC-016b: AiServiceError with custom status → 保留 status", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const aiErr = new aiMock.AiServiceError("AI_API_CALL_FAILED", "AI 请求失败", 502);
    mocks.createTask.mockRejectedValue(aiErr);
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("AI_API_CALL_FAILED");
  });

  // ─── GC-017: 普通 Error → 500 + AI_API_CALL_FAILED ───

  it("GC-017: 普通 Error → 500 + AI_API_CALL_FAILED + 原始 message", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockRejectedValue(new Error("未知内部错误"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("AI_API_CALL_FAILED");
    expect(body.message).toContain("未知内部错误");
  });

  // ─── GC-018: dedupeKey 保证不重复任务 ───

  it("GC-018: dedupeKey 包含 userId + contentItemId + cardType — 保证幂等", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("item-42", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "CARD_GENERATE:v:item-42:golden_sentence",
        userId: "v",
        type: "CARD_GENERATE",
      })
    );
  });

  it("GC-018b: 不同 cardType 产生不同 dedupeKey", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("item-42", USERS.VERIFIED, {
      cardTypes: ["golden_sentence", "case_material"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    const calls = mocks.createTask.mock.calls as Array<Array<{ dedupeKey: string }>>;
    const keys = calls.map((c) => c[0].dedupeKey);
    expect(keys).toContain("CARD_GENERATE:v:item-42:golden_sentence");
    expect(keys).toContain("CARD_GENERATE:v:item-42:case_material");
    expect(keys).toHaveLength(2);
  });

  // ─── GC-019: user A/B 隔离 ───

  it("GC-019: 用户 A 已生成卡片不影响用户 B — findFirst 含 ownerUserId", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t-b", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED_B, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.findFirstCard).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerUserId: "vb" }),
      })
    );
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "CARD_GENERATE:vb:x:golden_sentence",
        userId: "vb",
      })
    );
  });

  it("GC-019b: 用户 A 已有卡片 → 409；用户 B 无卡片 → 202", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "card-a", ownerUserId: "v" });
    const [reqA, ctxA] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const resA = await POST(reqA, ctxA);
    expect(resA.status).toBe(409);

    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t-b", type: "CARD_GENERATE" });
    const [reqB, ctxB] = makeReq("x", USERS.VERIFIED_B, { cardType: "golden_sentence" });
    const resB = await POST(reqB, ctxB);
    expect(resB.status).toBe(202);
  });

  // ─── GC-020: 每日生成次数达上限 → 429 + 中文提示 ───

  it("GC-020: 每日生成次数达上限 → 429 + 中文提示", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    const { RateLimitError } = await import("@/lib/async-task");
    mocks.createTask.mockRejectedValue(new RateLimitError("每日生成次数已达上限"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.message).toContain("每日");
  });

  // ─── 额外: 公共卡不阻止私有卡生成 ───

  it("GC-extra: 公共卡（ownerUserId=null）不阻止私有卡生成", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.findFirstCard).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerUserId: "v" }),
      })
    );
  });
});
