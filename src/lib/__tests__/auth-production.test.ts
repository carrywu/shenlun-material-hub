import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Helper to set NODE_ENV in tests (TypeScript marks it readonly)
function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

const mocks = vi.hoisted(() => ({
  userCount: vi.fn().mockResolvedValue(0),
  userFindUnique: vi.fn().mockResolvedValue(null),
  userCreate: vi.fn().mockResolvedValue({ id: "u1", username: "admin" }),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      count: mocks.userCount,
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mocks.hash },
}));

describe("ensureInitialAdmin — production guard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw in production when ADMIN_PASSWORD_HASH is not set", async () => {
    setNodeEnv("production");
    delete process.env.ADMIN_PASSWORD_HASH;
    mocks.userCount.mockResolvedValueOnce(0);
    mocks.userFindUnique.mockResolvedValueOnce(null);

    const { ensureInitialAdmin } = await import("@/lib/auth");
    await expect(ensureInitialAdmin()).rejects.toThrow(
      "Production environment requires ADMIN_PASSWORD_HASH"
    );
  });

  it("should throw in production when ADMIN_PASSWORD_HASH is not a bcrypt hash", async () => {
    setNodeEnv("production");
    process.env.ADMIN_PASSWORD_HASH = "some-sha256-hash-not-bcrypt";
    mocks.userCount.mockResolvedValueOnce(0);
    mocks.userFindUnique.mockResolvedValueOnce(null);

    const { ensureInitialAdmin } = await import("@/lib/auth");
    await expect(ensureInitialAdmin()).rejects.toThrow(
      "Production environment requires ADMIN_PASSWORD_HASH"
    );
  });

  it("should succeed in production with valid bcrypt ADMIN_PASSWORD_HASH", async () => {
    setNodeEnv("production");
    process.env.ADMIN_PASSWORD_HASH = "$2a$12$validbcrypthashvaluehere123456789012";
    mocks.userCount.mockResolvedValueOnce(0);
    mocks.userFindUnique.mockResolvedValueOnce(null);

    const { ensureInitialAdmin } = await import("@/lib/auth");
    await expect(ensureInitialAdmin()).resolves.toBeUndefined();
    expect(mocks.userCreate).toHaveBeenCalled();
  });

  it("should use default password in development when no env var is set", async () => {
    setNodeEnv("development");
    delete process.env.ADMIN_PASSWORD_HASH;
    mocks.userCount.mockResolvedValueOnce(0);
    mocks.userFindUnique.mockResolvedValueOnce(null);

    const { ensureInitialAdmin } = await import("@/lib/auth");
    await expect(ensureInitialAdmin()).resolves.toBeUndefined();
    expect(mocks.hash).toHaveBeenCalledWith("admin123", 12);
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  it("should skip creation when admin already exists", async () => {
    setNodeEnv("development");
    mocks.userCount.mockResolvedValueOnce(1);

    const { ensureInitialAdmin } = await import("@/lib/auth");
    await expect(ensureInitialAdmin()).resolves.toBeUndefined();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
