import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireAuth: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  validateSession: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  hashPassword: vi.fn().mockResolvedValue("$2a$12$hash"),
  verifyPassword: vi.fn().mockResolvedValue({ valid: true }),
  createSession: vi.fn().mockResolvedValue("test-token"),
  ensureInitialAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asyncTask: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

describe("GET /api/admin/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: "task-1", status: "RUNNING" }]);
    mocks.count.mockResolvedValue(1);
  });

  it("filters by status and paginates tasks", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest("http://localhost/api/admin/tasks?status=RUNNING&page=2&pageSize=5")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: "RUNNING" },
      orderBy: { createdAt: "desc" },
      skip: 5,
      take: 5,
    });
    expect(payload).toMatchObject({
      data: [{ id: "task-1", status: "RUNNING" }],
      total: 1,
      page: 2,
      pageSize: 5,
    });
  });
});
