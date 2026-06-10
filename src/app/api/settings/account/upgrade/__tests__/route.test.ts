import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
}));

const dbMocks = vi.hoisted(() => ({
  invitationFindUnique: vi.fn(),
  invitationUseFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findUnique: dbMocks.invitationFindUnique },
    invitationUse: { findFirst: dbMocks.invitationUseFindFirst },
    $transaction: dbMocks.transaction,
  },
}));

const user = {
  id: "user-1",
  username: "100001",
  displayName: "张三",
  role: "USER",
  status: "ACTIVE",
};

const invitation = {
  id: "inv-1",
  code: "ABC123",
  usedCount: 0,
  maxUses: 2,
  expiresAt: null,
  isEnabled: true,
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/settings/account/upgrade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/account/upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAuth.mockResolvedValue(user);
    dbMocks.invitationFindUnique.mockResolvedValue(invitation);
    dbMocks.invitationUseFindFirst.mockResolvedValue(null);
    dbMocks.transaction.mockImplementation(async (callback) => callback({
      invitation: {
        update: vi.fn().mockResolvedValue({ ...invitation, usedCount: 1 }),
      },
      invitationUse: {
        create: vi.fn().mockResolvedValue({ id: "use-1" }),
      },
      user: {
        update: vi.fn().mockResolvedValue({ ...user, role: "VERIFIED_USER" }),
      },
    }));
  });

  it("rejects disabled invitation codes", async () => {
    dbMocks.invitationFindUnique.mockResolvedValueOnce({ ...invitation, isEnabled: false });
    const { POST } = await import("../route");

    const response = await POST(request({ invitationCode: "ABC123" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("邀请码已被禁用");
  });

  it("upgrades a regular user to verified user in one transaction", async () => {
    const txInvitationUpdate = vi.fn().mockResolvedValue({ ...invitation, usedCount: 1 });
    const txInvitationUseCreate = vi.fn().mockResolvedValue({ id: "use-1" });
    const txUserUpdate = vi.fn().mockResolvedValue({ ...user, role: "VERIFIED_USER" });
    dbMocks.transaction.mockImplementationOnce(async (callback) => callback({
      invitation: { update: txInvitationUpdate },
      invitationUse: { create: txInvitationUseCreate },
      user: { update: txUserUpdate },
    }));
    const { POST } = await import("../route");

    const response = await POST(request({ invitationCode: " ABC123 " }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({ username: "100001", role: "VERIFIED_USER" });
    expect(txInvitationUpdate).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { usedCount: { increment: 1 } },
    });
    expect(txInvitationUseCreate).toHaveBeenCalledWith({
      data: { invitationId: "inv-1", userId: "user-1" },
    });
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "VERIFIED_USER" },
      select: { id: true, username: true, displayName: true, role: true },
    });
  });
});
