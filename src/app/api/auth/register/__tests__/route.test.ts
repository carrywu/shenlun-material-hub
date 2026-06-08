import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  createSession: vi.fn().mockResolvedValue("session-token"),
  buildCookieHeader: vi.fn().mockReturnValue("auth_token=session-token; Path=/"),
}));

const auditMocks = vi.hoisted(() => ({
  auditLog: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  invitationFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/audit-logger", () => auditMocks);
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findUnique: dbMocks.invitationFindUnique },
    user: { findUnique: dbMocks.userFindUnique },
    $transaction: dbMocks.transaction,
  },
}));

const activeInvitation = {
  id: "inv-1",
  code: "ABC123",
  usedCount: 0,
  maxUses: 2,
  expiresAt: null,
};

function registerRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.invitationFindUnique.mockResolvedValue(activeInvitation);
    dbMocks.userFindUnique.mockResolvedValue(null);
    dbMocks.transaction.mockImplementation(async (callback) => callback({
      invitation: {
        update: vi.fn().mockResolvedValue({ ...activeInvitation, usedCount: 1 }),
      },
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", username: "new_user", role: "USER", createdAt: new Date("2026-06-08T00:00:00Z") }),
      },
      invitationUse: {
        create: vi.fn().mockResolvedValue({ id: "use-1" }),
      },
    }));
  });

  it("returns 400 instead of 500 for non-string fields", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: 123, password: {}, invitationCode: [] }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "用户名、密码和邀请码必须为字符串" });
    expect(dbMocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("trims username and invitation code before lookup and duplicate checks", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "  new_user  ", password: "secret1", invitationCode: "  ABC123  " }));

    expect(response.status).toBe(201);
    expect(dbMocks.invitationFindUnique).toHaveBeenCalledWith({ where: { code: "ABC123" } });
    expect(dbMocks.userFindUnique).toHaveBeenCalledWith({ where: { username: "new_user" } });
    expect(auditMocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ username: "new_user", invitationCode: "AB****" }),
    }));
  });

  it("masks invitation code in expired invitation audit logs", async () => {
    dbMocks.invitationFindUnique.mockResolvedValueOnce({
      ...activeInvitation,
      expiresAt: new Date("2000-01-01T00:00:00Z"),
    });
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "new_user", password: "secret1", invitationCode: "ABC123" }));

    expect(response.status).toBe(400);
    expect(auditMocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        reason: "invitation_expired",
        invitationCode: "AB****",
        attemptedUsername: "new_user",
      }),
    }));
  });

  it("masks invitation code in exhausted invitation audit logs", async () => {
    dbMocks.invitationFindUnique.mockResolvedValueOnce({
      ...activeInvitation,
      usedCount: 2,
      maxUses: 2,
    });
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "new_user", password: "secret1", invitationCode: "ABC123" }));

    expect(response.status).toBe(400);
    expect(auditMocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        reason: "invitation_exhausted",
        invitationCode: "AB****",
        attemptedUsername: "new_user",
      }),
    }));
  });
});
