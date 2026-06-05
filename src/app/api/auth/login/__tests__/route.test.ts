import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  signJWT: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    verifyPassword: mocks.verifyPassword,
    signJWT: mocks.signJWT,
  };
});

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
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.signJWT.mockResolvedValue("jwt-token");
  });

  it("rejects production login when required auth env vars are missing", async () => {
    process.env.NODE_ENV = "production";
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "admin", password: "secret" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("ADMIN_PASSWORD_HASH");
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });

  it("logs a warning and allows fallback credentials in development", async () => {
    process.env.NODE_ENV = "development";
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ username: "admin", password: "admin123" }));

    expect(response.status).toBe(200);
    expect(mocks.loggerWarn).toHaveBeenCalled();
    expect(mocks.signJWT).toHaveBeenCalledTimes(1);
  });
});
