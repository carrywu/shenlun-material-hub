import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("env-validation — production checks", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should pass when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    const dbIssue = issues.find((i: { key: string }) => i.key === "DATABASE_URL");
    expect(dbIssue).toBeUndefined();
  });

  it("should report missing DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "DATABASE_URL")).toBe(true);
  });

  it("should reject default admin password in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    process.env.ADMIN_PASSWORD = "admin123";
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD")).toBe(true);
  });

  it("should require admin password in production when not set", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD_HASH")).toBe(true);
  });

  it("should accept valid bcrypt hash in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    process.env.ADMIN_PASSWORD_HASH = "$2a$12$validbcrypthashvaluehere123456789012";
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD")).toBe(false);
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD_HASH")).toBe(false);
  });

  it("should reject non-bcrypt ADMIN_PASSWORD_HASH in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    process.env.ADMIN_PASSWORD_HASH = "not-a-bcrypt-hash";
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD_HASH")).toBe(true);
  });

  it("should pass in development without admin password", async () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://shenlun:dev@localhost:5432/shenlun_test";
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    const { validateEnv } = await import("@/lib/env-validation");
    const issues = validateEnv();
    expect(issues.some((i: { key: string }) => i.key === "ADMIN_PASSWORD")).toBe(false);
  });
});
