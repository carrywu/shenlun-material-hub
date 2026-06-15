import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, auditMock, mocks, dbMock } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const mocks = {
    invitationFindUnique: fn(),
    userFindUnique: fn(),
    invUpdate: fn(),
    userCreate: fn(),
    invUseCreate: fn(),
  };
  const dbMock = {
    invitation: { findUnique: mocks.invitationFindUnique },
    user: { findUnique: mocks.userFindUnique },
    $transaction: vi.fn(async (txFn: (tx: unknown) => Promise<unknown>) =>
      txFn({
        invitation: { update: mocks.invUpdate },
        user: { create: mocks.userCreate },
        invitationUse: { create: mocks.invUseCreate },
      })
    ),
  };
  return {
    authMock: {
      hashPassword: vi.fn().mockResolvedValue("hash"),
      createSession: vi.fn().mockResolvedValue("token"),
      buildCookieHeader: vi.fn().mockReturnValue("cookie"),
    },
    auditMock: { log: vi.fn().mockResolvedValue(undefined) },
    mocks,
    dbMock,
  };
});
vi.mock("@/lib/auth", () => authMock);
vi.mock("@/lib/audit-logger", () => ({ auditLog: auditMock.log }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register (P8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("无邀请码 → 创建 USER", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({
      id: "u1", username: "x", role: "USER", createdAt: new Date(),
    });
    const res = await POST(makeReq({ username: "newuser", password: "pass123" }));
    expect(res.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
    );
    expect(mocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("有有效邀请码 → 创建 VERIFIED_USER", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      id: "inv1", code: "CODE", status: "ACTIVE", isEnabled: true, usedCount: 0, maxUses: 5, expiresAt: null,
    });
    mocks.invUpdate.mockResolvedValue({
      id: "inv1", code: "CODE", status: "ACTIVE", isEnabled: true, usedCount: 1, maxUses: 5, expiresAt: null,
    });
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({
      id: "u2", username: "x", role: "VERIFIED_USER", createdAt: new Date(),
    });
    const res = await POST(makeReq({
      username: "newuser2", password: "pass123", invitationCode: "CODE",
    }));
    expect(res.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "VERIFIED_USER" }) })
    );
  });

  it("已停用邀请码 → 400", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      id: "inv-disabled",
      code: "STOPPED",
      status: "DISABLED",
      isEnabled: true,
      usedCount: 0,
      maxUses: 5,
      expiresAt: null,
    });

    const res = await POST(makeReq({
      username: "newuser3",
      password: "pass123",
      invitationCode: "STOPPED",
    }));
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("邀请码已停用");
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("旧字段已停用的邀请码 → 400", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      id: "inv-disabled-legacy",
      code: "LEGACY",
      status: "ACTIVE",
      isEnabled: false,
      usedCount: 0,
      maxUses: 5,
      expiresAt: null,
    });

    const res = await POST(makeReq({
      username: "newuser4",
      password: "pass123",
      invitationCode: "LEGACY",
    }));
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("邀请码已停用");
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("无效邀请码 → 400", async () => {
    mocks.invitationFindUnique.mockResolvedValue(null);
    const res = await POST(makeReq({
      username: "x", password: "pass123", invitationCode: "BAD",
    }));
    expect(res.status).toBe(400);
  });

  it("用户名密码缺失 → 400", async () => {
    const res = await POST(makeReq({ username: "x" }));
    expect(res.status).toBe(400);
  });
});
