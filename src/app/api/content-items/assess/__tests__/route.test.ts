import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifiedUser = { id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" as const };

const authMocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
}));

const dbMocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

const taskMocks = vi.hoisted(() => ({
  createAsyncTask: vi.fn(),
  enqueueAsyncTask: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      count: dbMocks.count,
      findMany: dbMocks.findMany,
      update: dbMocks.update,
    },
  },
}));
vi.mock("@/lib/async-task", () => taskMocks);
vi.mock("@/services/ai", () => ({
  assessRelevanceWithRetry: vi.fn(),
  AiServiceError: class AiServiceError extends Error {
    code = "AI_API_CALL_FAILED";
    status = 500;
  },
}));

describe("POST /api/content-items/assess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireVerifiedUser.mockResolvedValue(verifiedUser);
    dbMocks.count.mockResolvedValue(2);
    taskMocks.createAsyncTask.mockResolvedValue({ id: "task-1", type: "AI_ASSESS" });
  });

  it("creates AI assessment tasks bound to the initiating user", async () => {
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items/assess", {
      method: "POST",
      body: JSON.stringify({ ids: ["item-1", "item-2"], concurrency: 2 }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({ accepted: true, taskId: "task-1", queuedCount: 2 });
    expect(taskMocks.createAsyncTask).toHaveBeenCalledWith(
      "AI_ASSESS",
      expect.objectContaining({ ids: ["item-1", "item-2"], concurrency: 2, itemCount: 2 }),
      "user-1"
    );
    expect(taskMocks.enqueueAsyncTask).toHaveBeenCalledTimes(1);
  });
});
