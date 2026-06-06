import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AsyncTaskType = "WEWE_RSS_SYNC" | "WEB_CRAWL" | "AI_ASSESS" | "CARD_GENERATE";
type AsyncTaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

type DetachedTaskHandler = () => Promise<unknown>;

interface QueuedTask {
  id: string;
  type: string;
  handler: DetachedTaskHandler;
}

interface TaskQueueState {
  activeCount: number;
  pending: QueuedTask[];
  scheduled: boolean;
}

const TASK_QUEUE_KEY = Symbol.for("shenlun-material-hub.async-task-queue");
const DEFAULT_CONCURRENCY = 2;

function serialize(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "Failed to serialize task payload" });
  }
}

function parseConcurrency(rawValue: string | undefined): number {
  const parsed = Number(rawValue ?? DEFAULT_CONCURRENCY);
  if (!Number.isFinite(parsed)) return DEFAULT_CONCURRENCY;
  return Math.min(8, Math.max(1, Math.trunc(parsed)));
}

function getQueueState(): TaskQueueState {
  const globalState = globalThis as typeof globalThis & {
    [TASK_QUEUE_KEY]?: TaskQueueState;
  };

  if (!globalState[TASK_QUEUE_KEY]) {
    globalState[TASK_QUEUE_KEY] = {
      activeCount: 0,
      pending: [],
      scheduled: false,
    };
  }

  return globalState[TASK_QUEUE_KEY];
}

function getTaskConcurrency(): number {
  return parseConcurrency(process.env.ASYNC_TASK_CONCURRENCY);
}

function scheduleQueueDrain() {
  const queue = getQueueState();
  if (queue.scheduled) return;
  queue.scheduled = true;
  setTimeout(() => {
    queue.scheduled = false;
    void drainTaskQueue();
  }, 0);
}

async function runQueuedTask(task: QueuedTask) {
  await markAsyncTaskRunning(task.id);

  try {
    const result = await task.handler();
    await completeAsyncTask(task.id, result);
  } catch (error) {
    await failAsyncTask(task.id, error);
    await logger.error("Detached async task failed", "SYSTEM", {
      taskId: task.id,
      taskType: task.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function drainTaskQueue() {
  const queue = getQueueState();
  const concurrency = getTaskConcurrency();

  while (queue.activeCount < concurrency && queue.pending.length > 0) {
    const task = queue.pending.shift();
    if (!task) break;

    queue.activeCount += 1;
    void runQueuedTask(task).finally(() => {
      const currentQueue = getQueueState();
      currentQueue.activeCount = Math.max(0, currentQueue.activeCount - 1);
      scheduleQueueDrain();
    });
  }
}

export async function createAsyncTask(type: AsyncTaskType, params?: unknown, userId?: string) {
  return db.asyncTask.create({
    data: {
      type,
      status: "PENDING",
      params: serialize(params),
      ...(userId ? { userId } : {}),
    },
  });
}

export function enqueueAsyncTask(
  task: { id: string; type: string },
  handler: DetachedTaskHandler
) {
  const queue = getQueueState();
  queue.pending.push({
    id: task.id,
    type: task.type,
    handler,
  });
  scheduleQueueDrain();
}

export async function markAsyncTaskRunning(id: string, result?: unknown) {
  return db.asyncTask.update({
    where: { id },
    data: {
      status: "RUNNING",
      result: serialize(result),
    },
  });
}

export async function completeAsyncTask(id: string, result?: unknown) {
  return db.asyncTask.update({
    where: { id },
    data: {
      status: "COMPLETED",
      result: serialize(result),
      completedAt: new Date(),
    },
  });
}

export async function failAsyncTask(id: string, error: unknown) {
  const payload =
    error instanceof Error
      ? { message: error.message }
      : { message: typeof error === "string" ? error : "Unknown error" };

  try {
    return await db.asyncTask.update({
      where: { id },
      data: {
        status: "FAILED",
        result: serialize(payload),
        completedAt: new Date(),
      },
    });
  } catch (updateError) {
    await logger.error("Failed to persist async task failure", "SYSTEM", {
      taskId: id,
      payload,
      updateError: updateError instanceof Error ? updateError.message : "unknown",
    });
    return null;
  }
}

export async function updateAsyncTaskResult(
  id: string,
  result: unknown,
  status?: AsyncTaskStatus
) {
  return db.asyncTask.update({
    where: { id },
    data: {
      result: serialize(result),
      ...(status ? { status } : {}),
      ...(status === "COMPLETED" || status === "FAILED"
        ? { completedAt: new Date() }
        : {}),
    },
  });
}

export async function getAsyncTaskById(id: string) {
  return db.asyncTask.findUnique({
    where: { id },
  });
}

/**
 * 检查用户是否可以创建新任务（速率限制）
 * - 每用户最多 MAX_CONCURRENT 个并发任务
 * - 每用户每天最多 MAX_DAILY 个任务
 */
export async function checkTaskRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const MAX_CONCURRENT = 3;  // 最大并发任务
  const MAX_DAILY = 50;      // 每日最大任务数

  // 检查并发任务数
  const runningCount = await db.asyncTask.count({
    where: { userId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (runningCount >= MAX_CONCURRENT) {
    return { allowed: false, reason: `并发任务数已达上限 (${MAX_CONCURRENT})` };
  }

  // 检查每日任务数
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyCount = await db.asyncTask.count({
    where: { userId, createdAt: { gte: todayStart } },
  });
  if (dailyCount >= MAX_DAILY) {
    return { allowed: false, reason: `今日任务数已达上限 (${MAX_DAILY})` };
  }

  return { allowed: true };
}
