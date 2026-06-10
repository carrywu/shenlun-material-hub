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
  isEnabled: true,
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
        create: vi.fn().mockResolvedValue({
          id: "user-1",
          username: "100001",
          displayName: "张三",
          role: "USER",
          createdAt: new Date("2026-06-08T00:00:00Z"),
        }),
      },
      invitationUse: {
        create: vi.fn().mockResolvedValue({ id: "use-1" }),
      },
    }));
  });

  it("returns 400 instead of 500 for non-string required fields", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: 123, displayName: [], password: {} }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "账号、昵称和密码必须为字符串" });
    expect(dbMocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("rejects non-alphanumeric account names", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "用户甲", displayName: "张三", password: "secret1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "账号只能包含数字和英文字母" });
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects blank display names", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "100001", displayName: "   ", password: "secret1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "昵称不能为空" });
  });

  it("rejects passwords longer than 18 characters", async () => {
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "100001", displayName: "张三", password: "1234567890123456789" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "密码长度应为 6-18 位" });
  });

  it("registers a regular user without an invitation code", async () => {
    const txUserCreate = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "100001",
      displayName: "张三",
      role: "USER",
      createdAt: new Date("2026-06-08T00:00:00Z"),
    });
    dbMocks.transaction.mockImplementationOnce(async (callback) => callback({
      user: { create: txUserCreate },
      invitation: { update: vi.fn() },
      invitationUse: { create: vi.fn() },
    }));
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "  100001  ", displayName: "  张三  ", password: "secret1" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user).toMatchObject({ username: "100001", displayName: "张三", role: "USER" });
    expect(dbMocks.userFindUnique).toHaveBeenCalledWith({ where: { username: "100001" } });
    expect(dbMocks.invitationFindUnique).not.toHaveBeenCalled();
    expect(txUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ username: "100001", displayName: "张三", role: "USER" }),
    }));
  });

  it("registers a verified user when a valid invitation code is supplied", async () => {
    const txInvitationUpdate = vi.fn().mockResolvedValue({ ...activeInvitation, usedCount: 1 });
    const txInvitationUseCreate = vi.fn().mockResolvedValue({ id: "use-1" });
    const txUserCreate = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "100001",
      displayName: "张三",
      role: "VERIFIED_USER",
      createdAt: new Date("2026-06-08T00:00:00Z"),
    });
    dbMocks.transaction.mockImplementationOnce(async (callback) => callback({
      invitation: { update: txInvitationUpdate },
      user: { create: txUserCreate },
      invitationUse: { create: txInvitationUseCreate },
    }));
    const { POST } = await import("../route");

    const response = await POST(registerRequest({
      username: "100001",
      displayName: "张三",
      password: "secret1",
      invitationCode: "  ABC123  ",
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user).toMatchObject({ username: "100001", displayName: "张三", role: "VERIFIED_USER" });
    expect(dbMocks.invitationFindUnique).toHaveBeenCalledWith({ where: { code: "ABC123" } });
    expect(txUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ username: "100001", displayName: "张三", role: "VERIFIED_USER" }),
    }));
    expect(txInvitationUseCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ invitationId: "inv-1", userId: "user-1" }),
    }));
  });

  it("masks invitation code in expired invitation audit logs", async () => {
    dbMocks.invitationFindUnique.mockResolvedValueOnce({
      ...activeInvitation,
      expiresAt: new Date("2000-01-01T00:00:00Z"),
    });
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "100001", displayName: "张三", password: "secret1", invitationCode: "ABC123" }));

    expect(response.status).toBe(400);
    expect(auditMocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        reason: "invitation_expired",
        invitationCode: "AB****",
        attemptedUsername: "100001",
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

    const response = await POST(registerRequest({ username: "100001", displayName: "张三", password: "secret1", invitationCode: "ABC123" }));

    expect(response.status).toBe(400);
    expect(auditMocks.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        reason: "invitation_exhausted",
        invitationCode: "AB****",
        attemptedUsername: "100001",
      }),
    }));
  });

  it("rejects disabled invitation codes", async () => {
    dbMocks.invitationFindUnique.mockResolvedValueOnce({
      ...activeInvitation,
      isEnabled: false,
    });
    const { POST } = await import("../route");

    const response = await POST(registerRequest({ username: "100001", displayName: "张三", password: "secret1", invitationCode: "ABC123" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "邀请码已被禁用" });
  });
});
