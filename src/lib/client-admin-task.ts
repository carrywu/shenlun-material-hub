"use client";

export interface AdminTaskSnapshot {
  id: string;
  type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  params: string | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAdminTask(taskId: string): Promise<AdminTaskSnapshot> {
  const response = await fetch(`/api/admin/tasks/${taskId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("获取任务状态失败");
  }

  return response.json() as Promise<AdminTaskSnapshot>;
}

export async function waitForAdminTask(
  taskId: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
  }
) {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const intervalMs = options?.intervalMs ?? 1_500;
  const startedAt = Date.now();

  let snapshot = await fetchAdminTask(taskId);
  while (snapshot.status === "PENDING" || snapshot.status === "RUNNING") {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("等待后台任务超时");
    }
    await sleep(intervalMs);
    snapshot = await fetchAdminTask(taskId);
  }

  return snapshot;
}
