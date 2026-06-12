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

// Helper to set/delete NODE_ENV in tests (TypeScript marks it readonly)
function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = value;
  }
}

describe("POST /api/auth/login", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  const originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const env = process.env as Record<string, string | undefined>;
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalAdminUsername === undefined) delete env.ADMIN_USERNAME;
    else env.ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminPasswordHash === undefined) delete env.ADMIN_PASSWORD_HASH;
    else env.ADMIN_PASSWORD_HASH = originalAdminPasswordHash;
    if (originalJwtSecret === undefined) delete env.JWT_SECRET;
    else env.JWT_SECRET = originalJwtSecret;

    delete env.ADMIN_USERNAME;
    delete env.ADMIN_PASSWORD_HASH;
    delete env.JWT_SECRET;
    setNodeEnv(undefined);
    mocks.verifyPassword.mockResolvedValue({ valid: true });
    mocks.hashPassword.mockResolvedValue("$2a$12$newhash");
    mocks.createSession.mockResolvedValue("session-token");
    mocks.ensureInitialAdmin.mockResolvedValue(undefined);
    mocks.buildCookieHeader.mockReturnValue("auth_token=session-token; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400");
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      passwordHash: "$2a$12$existinghash",
      role: "ADMIN",
      status: "ACTIVE",
      displayName: "管理员",
    });
    mocks.userUpdate.mockResolvedValue({});
  });

  it("rejects login when user is not found", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    setNodeEnv("production");
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "nonexistent", password: "secret" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("用户名或密码错误");
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects login when password is wrong", async () => {
    mocks.verifyPassword.mockResolvedValue({ valid: false });
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "admin", password: "wrong" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("用户名或密码错误");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("logs in successfully and creates a session", async () => {
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "admin", password: "admin123" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(mocks.buildCookieHeader).toHaveBeenCalledWith("session-token");
  });
});
