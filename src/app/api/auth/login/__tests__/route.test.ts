import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
  buildCookieHeader: vi.fn().mockReturnValue("auth_token=test-token; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400"),
  ensureInitialAdmin: vi.fn().mockResolvedValue(undefined),
  requireAdmin: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireAuth: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  validateSession: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
  createSession: mocks.createSession,
  buildCookieHeader: mocks.buildCookieHeader,
  ensureInitialAdmin: mocks.ensureInitialAdmin,
  requireAdmin: mocks.requireAdmin,
  requireAuth: mocks.requireAuth,
  unauthorizedResponse: mocks.unauthorizedResponse,
  forbiddenResponse: mocks.forbiddenResponse,
  validateSession: mocks.validateSession,
  cleanExpiredSessions: vi.fn().mockResolvedValue(0),
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

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  const originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = originalAdminPasswordHash;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;

    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
    mocks.verifyPassword.mockResolvedValue({ valid: true });
    mocks.hashPassword.mockResolvedValue("$2a$12$newhash");
    mocks.createSession.mockResolvedValue("session-token");
    mocks.ensureInitialAdmin.mockResolvedValue(undefined);
    mocks.buildCookieHeader.mockReturnValue("auth_token=session-token; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400");
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      username: "100001",
      passwordHash: "$2a$12$existinghash",
      role: "ADMIN",
      status: "ACTIVE",
      displayName: "管理员",
    });
    mocks.userUpdate.mockResolvedValue({});
  });

  it("rejects login when user is not found", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    process.env.NODE_ENV = "production";
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "999999", password: "secret" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("用户名或密码错误");
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects non-alphanumeric account names before looking up the user", async () => {
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "用户甲", password: "admin123" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("账号只能包含数字和英文字母");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects login when password is wrong", async () => {
    mocks.verifyPassword.mockResolvedValue({ valid: false });
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "100001", password: "wrong" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("用户名或密码错误");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("logs in successfully and creates a session", async () => {
    const { POST } = await import("../route");

    mocks.userFindUnique.mockResolvedValueOnce({
      id: "user-1",
      username: "100001",
      passwordHash: "$2a$12$existinghash",
      role: "VERIFIED_USER",
      status: "ACTIVE",
      displayName: "张三",
    });

    const response = await POST(makeRequest({ username: "100001", password: "admin123" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.user).toMatchObject({
      username: "100001",
      role: "VERIFIED_USER",
      displayName: "张三",
    });
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(mocks.buildCookieHeader).toHaveBeenCalledWith("session-token");
  });
});
