import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
    USER: { id: "u", username: "u", role: "USER" as const, status: "ACTIVE" as const },
  },
  authMocks: {
    // role-aware: requireVerifiedUser admits ADMIN + VERIFIED_USER only
    requireVerifiedUser: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: authMocks.requireVerifiedUser,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: (m?: string) => Response.json({ error: m ?? "x" }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirstCard: vi.fn(),
  createTask: vi.fn(),
  enqueue: vi.fn(),
  rateLimit: vi.fn(),
  update: vi.fn(),
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
  AiServiceError: class extends Error {
    code = "X";
    status = 500;
  },
}));

import { POST } from "../route";

function makeReq(id: string, user: unknown, body: unknown) {
  authMocks.requireVerifiedUser.mockResolvedValue(user);
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
  // NextRequest expects its own RequestInit where signal cannot be null
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

describe("POST /api/content-items/[id]/generate-card (P5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("USER → 403", async () => {
    const [req, ctx] = makeReq("x", USERS.USER, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("adminReviewStatus != approved → 400", async () => {
    mocks.findUnique.mockResolvedValue({ ...APPROVED_ITEM, adminReviewStatus: "pending_admin" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("同用户同类型已存在 → 409", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "existing", ownerUserId: "v" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
  });

  it("公共卡（ownerUserId=null）不阻止私有卡生成 + findFirst 含 ownerUserId", async () => {
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

  it("卡包模式：cardTypes 数组 → 串行 enqueue 多任务", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", USERS.VERIFIED, {
      cardTypes: ["golden_sentence", "standard_expression", "case_material", "countermeasure"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.createTask).toHaveBeenCalledTimes(4);
  });

  it("速率限制命中 → 429", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    // createDedupTask 抛 RateLimitError（限流在事务内）
    mocks.createTask.mockRejectedValue(new (await import("@/lib/async-task")).RateLimitError("并发上限"));
    const [req, ctx] = makeReq("x", USERS.VERIFIED, { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(429);
  });

  it("卡包模式：中途限流 → 202 + 已接受任务 + rateLimited 标记", async () => {
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    // 前 3 次 createDedupTask 成功，第 4 次抛 RateLimitError
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
    const j = await res.json();
    expect(j.rateLimited).toBe(true);
    expect(j.rateLimitReason).toBe("并发上限");
    // 前 3 个类型已接受
    expect(j.tasks.length).toBe(3);
    expect(mocks.createTask).toHaveBeenCalledTimes(4); // 3 成功 + 1 抛
  });
});
