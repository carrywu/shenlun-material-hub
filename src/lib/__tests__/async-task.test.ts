import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// ─── Mock setup ───
// Tests for queue execution: enqueueAsyncTask, drainTaskQueue, runQueuedTask
// These use db.asyncTask.update (markRunning, complete, fail) and logger.error

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asyncTask: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: vi.fn(),
  },
}));

describe("async task queue execution — P0-5 (TASK-001, TASK-007~010)", () => {
  let originalConcurrency: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.create.mockResolvedValue({ id: "task-1" });
    mocks.update.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({ id: "task-1", status: "PENDING" });
    originalConcurrency = process.env.ASYNC_TASK_CONCURRENCY;

    // Reset global queue state between tests
    const globalState = globalThis as typeof globalThis & {
      [key: symbol]: { activeCount: number; pending: unknown[]; scheduled: boolean };
    };
    const key = Symbol.for("shenlun-material-hub.async-task-queue");
    delete globalState[key];
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.ASYNC_TASK_CONCURRENCY = originalConcurrency;
  });

  // ─── TASK-001 (partial): createAsyncTask creates pending task ───

  it("TASK-001: createAsyncTask → pending 状态 + 序列化参数", async () => {
    const { createAsyncTask } = await import("../async-task");

    const task = await createAsyncTask("CARD_GENERATE", { contentItemId: "c1" }, "u1");

    expect(task).toEqual({ id: "task-1" });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        type: "CARD_GENERATE",
        status: "PENDING",
        params: JSON.stringify({ contentItemId: "c1" }),
        userId: "u1",
      },
    });
  });

  // ─── TASK-007: 任务执行成功 → mark RUNNING + complete ───

  it("TASK-007: enqueueAsyncTask + handler 成功 → markAsyncTaskRunning + completeAsyncTask", async () => {
    const { enqueueAsyncTask } = await import("../async-task");
    const handler = vi.fn().mockResolvedValue({ cardId: "c1" });

    process.env.ASYNC_TASK_CONCURRENCY = "1";
    enqueueAsyncTask({ id: "task-7", type: "CARD_GENERATE" }, handler);

    // Advance timers to trigger the queue drain
    await vi.advanceTimersByTimeAsync(100);

    expect(handler).toHaveBeenCalledTimes(1);

    // First update: mark RUNNING, second update: complete COMPLETED
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: "task-7" },
      data: expect.objectContaining({ status: "RUNNING" }),
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { id: "task-7" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    });
  });

  // ─── TASK-008: 任务执行失败 → status=FAILED + error ───

  it("TASK-008: handler 抛错 → failAsyncTask 被调用 + FAILED 状态", async () => {
    const { enqueueAsyncTask } = await import("../async-task");
    const handler = vi.fn().mockRejectedValue(new Error("AI 服务不可用"));

    process.env.ASYNC_TASK_CONCURRENCY = "1";
    enqueueAsyncTask({ id: "task-8", type: "CARD_GENERATE" }, handler);

    await vi.advanceTimersByTimeAsync(100);

    expect(handler).toHaveBeenCalledTimes(1);

    // First update: mark RUNNING, second update: fail FAILED
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: "task-8" },
      data: expect.objectContaining({ status: "RUNNING" }),
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { id: "task-8" },
      data: expect.objectContaining({
        status: "FAILED",
        result: JSON.stringify({ message: "AI 服务不可用" }),
      }),
    });
  });

  // ─── TASK-009: 任务失败不会吞异常 → logger 记录错误 ───

  it("TASK-009: handler 失败 → logger.error 被调用记录 taskId + error", async () => {
    const { enqueueAsyncTask } = await import("../async-task");
    const handler = vi.fn().mockRejectedValue(new Error("致命错误"));

    process.env.ASYNC_TASK_CONCURRENCY = "1";
    enqueueAsyncTask({ id: "task-9", type: "CARD_GENERATE" }, handler);

    await vi.advanceTimersByTimeAsync(100);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      "Detached async task failed",
      "SYSTEM",
      expect.objectContaining({
        taskId: "task-9",
        taskType: "CARD_GENERATE",
        error: "致命错误",
      })
    );
  });

  // ─── TASK-010: 队列执行顺序稳定 → FIFO ───

  it("TASK-010: 多任务入队 → 按 FIFO 顺序执行（串行模式下）", async () => {
    const executionOrder: string[] = [];
    const makeHandler = (label: string) => {
      let resolve: () => void;
      const promise = new Promise<void>((r) => { resolve = r; });
      return {
        handler: () => {
          executionOrder.push(label);
          resolve();
          return Promise.resolve();
        },
        promise,
      };
    };

    const h1 = makeHandler("a");
    const h2 = makeHandler("b");
    const h3 = makeHandler("c");

    process.env.ASYNC_TASK_CONCURRENCY = "1";
    const { enqueueAsyncTask } = await import("../async-task");

    enqueueAsyncTask({ id: "t-a", type: "CARD_GENERATE" }, h1.handler);
    enqueueAsyncTask({ id: "t-b", type: "CARD_GENERATE" }, h2.handler);
    enqueueAsyncTask({ id: "t-c", type: "CARD_GENERATE" }, h3.handler);

    // Advance timers enough for all three to drain
    await vi.advanceTimersByTimeAsync(500);

    expect(executionOrder).toEqual(["a", "b", "c"]);
  });
});
