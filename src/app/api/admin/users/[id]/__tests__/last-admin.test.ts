import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hashPassword: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  countActiveAdmins: vi.fn(),
  unauthorizedResponse: vi.fn(),
  forbiddenResponse: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  hashPassword: mocks.hashPassword,
  revokeAllUserSessions: mocks.revokeAllUserSessions,
  countActiveAdmins: mocks.countActiveAdmins,
  unauthorizedResponse: mocks.unauthorizedResponse,
  forbiddenResponse: mocks.forbiddenResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

function makeRequest(body: Record<string, unknown>, id: string) {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: "auth_token=test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/admin/users/[id] — last admin demotion prevention", () => {
  const adminUser = {
    id: "admin-1",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(adminUser);
    mocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 })
    );
    mocks.forbiddenResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
  });

  it("rejects demotion when there is only 1 active admin", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    mocks.countActiveAdmins.mockResolvedValue(1);

    const { PUT } = await import("../route");

    const response = await PUT(
      makeRequest({ role: "USER" }, "admin-1"),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("不能降级最后一个管理员");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("allows role change when there are 2+ active admins", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    mocks.countActiveAdmins.mockResolvedValue(2);
    mocks.userUpdate.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      role: "USER",
      status: "ACTIVE",
    });

    const { PUT } = await import("../route");

    const response = await PUT(
      makeRequest({ role: "USER" }, "admin-1"),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.role).toBe("USER");
    expect(mocks.userUpdate).toHaveBeenCalled();
  });

  it("rejects disabling the last admin", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    mocks.countActiveAdmins.mockResolvedValue(1);

    const { PUT } = await import("../route");

    const response = await PUT(
      makeRequest({ status: "DISABLED" }, "admin-1"),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("不能禁用最后一个管理员");
  });
});
