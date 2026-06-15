import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, dbMocks, auditMock } = vi.hoisted(() => ({
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" }),
    unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
    forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  },
  dbMocks: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/audit-logger", () => ({ auditLog: auditMock }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      findUnique: dbMocks.findUnique,
      update: dbMocks.update,
    },
  },
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/invitations/inv-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/invitations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables an active invitation", async () => {
    dbMocks.findUnique.mockResolvedValue({ id: "inv-1", code: "ABCD1234", status: "ACTIVE", isEnabled: true });
    dbMocks.update.mockResolvedValue({ id: "inv-1", code: "ABCD1234", status: "DISABLED", isEnabled: false });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeReq({ status: "DISABLED" }), { params: Promise.resolve({ id: "inv-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.invitation.status).toBe("DISABLED");
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "DISABLED", isEnabled: false },
      select: expect.any(Object),
    });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "invitation_disable",
      resource: "Invitation",
      resourceId: "inv-1",
    }));
  });

  it("rejects attempts to restore invitation status", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeReq({ status: "ACTIVE" }), { params: Promise.resolve({ id: "inv-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("邀请码只能作废，不能恢复");
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
