import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asyncTask: {
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

describe("async task helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: "task-1" });
    mocks.update.mockResolvedValue({});
  });

  it("creates a pending task with serialized params", async () => {
    const { createAsyncTask } = await import("../async-task");

    const task = await createAsyncTask("WEB_CRAWL", {
      sourceId: "src-1",
      scope: "single-source",
    });

    expect(task).toEqual({ id: "task-1" });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        type: "WEB_CRAWL",
        status: "PENDING",
        params: JSON.stringify({ sourceId: "src-1", scope: "single-source" }),
      },
    });
  });

  it("marks tasks as completed or failed with serialized result", async () => {
    const { completeAsyncTask, failAsyncTask } = await import("../async-task");

    await completeAsyncTask("task-1", { importedCount: 3 });
    await failAsyncTask("task-2", new Error("boom"));

    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: "task-1" },
      data: {
        status: "COMPLETED",
        result: JSON.stringify({ importedCount: 3 }),
        completedAt: expect.any(Date),
      },
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { id: "task-2" },
      data: {
        status: "FAILED",
        result: JSON.stringify({ message: "boom" }),
        completedAt: expect.any(Date),
      },
    });
  });
});
