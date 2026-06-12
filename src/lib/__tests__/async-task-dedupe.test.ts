import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const executeRaw = vi.fn().mockResolvedValue(1);
  const count = vi.fn().mockResolvedValue(0);
  const create = vi.fn();
  const findFirst = vi.fn().mockResolvedValue(null);
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      $executeRaw: executeRaw,
      asyncTask: { count, create, findFirst },
    })
  );
  return { executeRaw, count, create, findFirst, $transaction };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.$transaction } }));

import { createDedupTask, RateLimitError } from "../async-task";

describe("createDedupTask (P0-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重新建立默认 mock 返回值（clearAllMocks 不重置 mockResolvedValue 实现）
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
  });

  it("事务内 advisory lock + 限流检查 + 创建", async () => {
    mocks.count.mockResolvedValue(0); // 未超限
    mocks.create.mockResolvedValue({ id: "task-1" });
    const task = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: { foo: "bar" },
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(mocks.executeRaw).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
          status: "PENDING",
        }),
      })
    );
    expect(task.id).toBe("task-1");
  });

  it("已有活跃同键任务 → 返回已存在，不重复创建", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-task" });
    mocks.create.mockResolvedValue({ id: "should-not-call" });
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

  it("并发超限 → 抛 RateLimitError，不创建", async () => {
    mocks.count.mockResolvedValueOnce(3); // 并发已达上限 3（第一次 count 调用 = runningCount）
    await expect(
      createDedupTask({
        type: "CARD_GENERATE",
        userId: "u1",
        dedupeKey: "CARD_GENERATE:u1:c2:golden_sentence",
        params: {},
        maxConcurrent: 3,
        maxDaily: 50,
      })
    ).rejects.toThrow(RateLimitError);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
