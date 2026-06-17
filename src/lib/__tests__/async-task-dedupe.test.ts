import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock setup ───
// createDedupTask uses db.$transaction(tx => { tx.$executeRaw, tx.asyncTask.findFirst/count/create })
// We mock $transaction to pass a mock tx object with those methods.

const mocks = vi.hoisted(() => {
  const executeRaw = vi.fn().mockResolvedValue(1);
  const findFirst = vi.fn().mockResolvedValue(null);
  const count = vi.fn().mockResolvedValue(0);
  const create = vi.fn().mockResolvedValue({ id: "task-new", type: "CARD_GENERATE" });
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      $executeRaw: executeRaw,
      asyncTask: { findFirst, count, create },
    })
  );
  return { executeRaw, findFirst, count, create, $transaction };
});

vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.$transaction } }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { createDedupTask, RateLimitError } from "../async-task";

describe("createDedupTask — P0-5 去重与限流 (TASK-001~006, TASK-011~012)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "task-new", type: "CARD_GENERATE" });
    mocks.executeRaw.mockResolvedValue(1);
  });

  // ─── TASK-001: 创建新任务 — pending 状态正确 ───

  it("TASK-001: 创建新任务 → 返回 pending 状态的任务", async () => {
    const task = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: { contentItemId: "c1" },
      maxConcurrent: 3,
      maxDaily: 50,
    });

    expect(mocks.executeRaw).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
          status: "PENDING",
          userId: "u1",
          type: "CARD_GENERATE",
        }),
      })
    );
    expect(task.id).toBe("task-new");
    expect(task.type).toBe("CARD_GENERATE");
  });

  // ─── TASK-002: 同 dedupeKey 重复创建 → 返回已存在 ───

  it("TASK-002: 同 dedupeKey 重复创建 → 返回已存在任务，不重复创建", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-task", type: "CARD_GENERATE" });
    const task = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task.id).toBe("existing-task");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // ─── TASK-003: 不同用户同文章同卡类型 → 各自允许 ───

  it("TASK-003: 不同用户同文章同卡类型 → 各自创建任务", async () => {
    // 用户 A 创建
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "task-a", type: "CARD_GENERATE" });
    const taskA = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "userA",
      dedupeKey: "CARD_GENERATE:userA:c1:golden_sentence",
      params: { contentItemId: "c1", cardType: "golden_sentence" },
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(taskA.id).toBe("task-a");
    expect(mocks.create).toHaveBeenCalledTimes(1);

    // 用户 B 创建相同文章+卡类型（dedupeKey 含不同 userId）
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "task-b", type: "CARD_GENERATE" });
    mocks.executeRaw.mockResolvedValue(1);
    const taskB = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "userB",
      dedupeKey: "CARD_GENERATE:userB:c1:golden_sentence",
      params: { contentItemId: "c1", cardType: "golden_sentence" },
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(taskB.id).toBe("task-b");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  // ─── TASK-004: 同用户不同 cardType → 允许不同任务 ───

  it("TASK-004: 同用户不同 cardType → 不同 dedupeKey → 各自创建", async () => {
    // golden_sentence
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "task-gs", type: "CARD_GENERATE" });
    const task1 = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task1.id).toBe("task-gs");

    // case_material（不同 dedupeKey，findFirst 查不同 key → 不去重）
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "task-cm", type: "CARD_GENERATE" });
    mocks.executeRaw.mockResolvedValue(1);
    const task2 = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:case_material",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task2.id).toBe("task-cm");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  // ─── TASK-005: maxConcurrent 达上限 → 抛 RateLimitError ───

  it("TASK-005: maxConcurrent 达上限 → 抛 RateLimitError + 中文原因", async () => {
    mocks.count.mockResolvedValue(3); // runningCount >= maxConcurrent(3)
    const promise = createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c2:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    await expect(promise).rejects.toThrow(RateLimitError);
    const err = await promise.catch((e) => e);
    expect(err.reason).toContain("并发");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // ─── TASK-006: maxDaily 达上限 → 抛 RateLimitError ───

  it("TASK-006: maxDaily 达上限 → 抛 RateLimitError + 中文原因", async () => {
    // first count call (runningCount) returns 0, second (dailyCount) returns 50
    mocks.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(50);
    const promise = createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c2:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    await expect(promise).rejects.toThrow(RateLimitError);
    const err = await promise.catch((e) => e);
    expect(err.reason).toContain("上限");
    expect(mocks.count).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // ─── TASK-011: 进程内并发点击 → 只创建一个有效任务 ───

  it("TASK-011: 同一 dedupeKey 重复调用 → findFirst 去重，只创建一个", async () => {
    // 第一次：无已存在 → 创建
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "t-1", type: "CARD_GENERATE" });
    const task1 = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task1.id).toBe("t-1");

    // 第二次：同 dedupeKey → findFirst 返回已存在 → 不创建
    mocks.findFirst.mockResolvedValue({ id: "t-1", type: "CARD_GENERATE" });
    const task2 = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task2.id).toBe("t-1"); // 返回已存在的，不是新建
    // create 只被第一次调用
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  // ─── TASK-012: dedupeKey 包含 userId → 防止跨用户干扰 ───

  it("TASK-012: dedupeKey 包含 userId → 不同用户 findFirst 查询各自 key → 互不干扰", async () => {
    const dedupeKeyA = "CARD_GENERATE:userA:c1:golden_sentence";
    const dedupeKeyB = "CARD_GENERATE:userB:c1:golden_sentence";

    // 用户 A 创建任务
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "ta", type: "CARD_GENERATE" });
    await createDedupTask({
      type: "CARD_GENERATE",
      userId: "userA",
      dedupeKey: dedupeKeyA,
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });

    // 用户 B 用不同 dedupeKey → findFirst 查自己的 key → 不被 A 去重
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null); // B 没有活跃同键任务
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "tb", type: "CARD_GENERATE" });
    mocks.executeRaw.mockResolvedValue(1);
    await createDedupTask({
      type: "CARD_GENERATE",
      userId: "userB",
      dedupeKey: dedupeKeyB,
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });

    // 用户 B 的 findFirst 查询包含 dedupeKey + userId: userB
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: dedupeKeyB,
          userId: "userB",
        }),
      })
    );
    expect(mocks.create).toHaveBeenCalled();
  });
});
