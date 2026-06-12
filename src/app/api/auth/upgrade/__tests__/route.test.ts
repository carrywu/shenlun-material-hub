import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
    USER: { id: "u", username: "u", role: "USER" as const, status: "ACTIVE" as const },
  },
  authMocks: { requireAuth: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const { mocks, dbMock } = vi.hoisted(() => {
  const mocks = {
    invFindUnique: vi.fn(),
    invUpdate: vi.fn(),
    invUseCreate: vi.fn(),
    userUpdate: vi.fn(),
  };
  const dbMock = {
    invitation: { findUnique: mocks.invFindUnique },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        invitation: { update: mocks.invUpdate },
        user: { update: mocks.userUpdate },
        invitationUse: { create: mocks.invUseCreate },
      })
    ),
  };
  return { mocks, dbMock };
});
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit-logger", () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "../route";

function makeReq(user: unknown | null, body: unknown, cookie: string | null = "auth_token=t") {
  authMocks.requireAuth.mockResolvedValue(user);
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
  if (cookie) init.headers = { ...init.headers, cookie };
  // NextRequest expects its own RequestInit where signal cannot be null
  const { signal, ...nextInit } = init;
  void signal;
  return new NextRequest("http://localhost/api/auth/upgrade", nextInit);
}

describe("POST /api/auth/upgrade (P8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("USER + 有效邀请码 → 升级 VERIFIED_USER", async () => {
    mocks.invFindUnique.mockResolvedValue({
      id: "i1", code: "CODE", usedCount: 0, maxUses: 5, expiresAt: null,
    });
    mocks.invUpdate.mockResolvedValue({
      id: "i1", code: "CODE", usedCount: 1, maxUses: 5, expiresAt: null,
    });
    mocks.userUpdate.mockResolvedValue({});
    const res = await POST(makeReq(USERS.USER, { invitationCode: "CODE" }));
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "VERIFIED_USER" } })
    );
  });

  it("VERIFIED_USER 再升级 → 400（已是认证用户）", async () => {
    const res = await POST(makeReq(USERS.VERIFIED, { invitationCode: "CODE" }));
    expect(res.status).toBe(400);
  });

  it("无效邀请码 → 400", async () => {
    mocks.invFindUnique.mockResolvedValue(null);
    const res = await POST(makeReq(USERS.USER, { invitationCode: "BAD" }));
    expect(res.status).toBe(400);
  });

  it("未登录 → 401", async () => {
    const res = await POST(makeReq(null, { invitationCode: "CODE" }, null));
    expect(res.status).toBe(401);
  });
});
