import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  const currentUser = { value: null as typeof ADMIN | null };
  // Mirror real requireAdmin/requireVerifiedUser role-filtering semantics.
  const requireAdmin = vi.fn(async () => {
    const u = currentUser.value;
    if (!u) return null;
    return u.role === "ADMIN" ? u : null;
  });
  const requireVerifiedUser = vi.fn(async () => {
    const u = currentUser.value;
    if (!u) return null;
    return u.role === "ADMIN" || u.role === "VERIFIED_USER" ? u : null;
  });
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { requireAdmin, requireVerifiedUser, currentUser },
  };
});

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: authMocks.requireVerifiedUser,
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const taskMocks = vi.hoisted(() => ({ create: vi.fn(), enqueue: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/async-task", () => ({
  createAsyncTask: taskMocks.create,
  enqueueAsyncTask: taskMocks.enqueue,
}));

vi.mock("@/lib/db", () => ({
  db: { contentItem: { count: taskMocks.count } },
}));

import { POST } from "../route";

function makeReq(cookie: string | null, body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/content-items/assess", init);
}

describe("POST /api/content-items/assess — permission lockdown (P4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.currentUser.value = null;
  });

  it("VERIFIED_USER → 403", async () => {
    authMocks.currentUser.value = USERS.VERIFIED;
    taskMocks.count.mockResolvedValue(1);
    const res = await POST(makeReq("auth_token=t", { ids: ["x"] }));
    expect(res.status).toBe(403);
    expect(taskMocks.create).not.toHaveBeenCalled();
  });

  it("匿名 → 401", async () => {
    authMocks.currentUser.value = null;
    const res = await POST(makeReq(null, { ids: ["x"] }));
    expect(res.status).toBe(401);
  });

  it("ADMIN → 进入任务队列（202）", async () => {
    authMocks.currentUser.value = USERS.ADMIN;
    taskMocks.count.mockResolvedValue(2);
    taskMocks.create.mockResolvedValue({ id: "task-1", type: "AI_ASSESS" });
    const res = await POST(makeReq("auth_token=t", { ids: ["a", "b"] }));
    expect(res.status).toBe(202);
    expect(taskMocks.create).toHaveBeenCalled();
    expect(taskMocks.enqueue).toHaveBeenCalled();
  });
});
