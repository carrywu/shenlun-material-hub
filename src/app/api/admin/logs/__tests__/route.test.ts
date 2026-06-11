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
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    systemLog: {
      findMany: mocks.findMany,
      count: mocks.count,
      deleteMany: mocks.deleteMany,
    },
  },
}));

describe("/api/admin/logs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: "log-1", level: "ERROR" }]);
    mocks.count.mockResolvedValue(1);
    mocks.deleteMany.mockResolvedValue({ count: 3 });
  });

  it("lists logs with filters", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest("http://localhost/api/admin/logs?level=ERROR&category=AUTH&page=1&pageSize=10")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { level: "ERROR", category: "AUTH" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
    });
    expect(payload.data).toEqual([{ id: "log-1", level: "ERROR" }]);
  });

  it("clears old logs by age or all", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/logs?olderThanDays=30")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expect.any(Date),
        },
      },
    });
    expect(payload.deleted).toBe(3);
  });
});
