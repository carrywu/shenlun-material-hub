import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
  },
  authMocks: { requireAdmin: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { roleQuota: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));

import { GET, PUT } from "../route";

describe("role-quotas (P6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER GET → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      headers: { cookie: "auth_token=t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("ADMIN GET → 返回配额列表", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.findMany.mockResolvedValue([
      { role: "USER", favoriteLimit: 100 },
      { role: "VERIFIED_USER", favoriteLimit: 300 },
    ]);
    const res = await GET(new NextRequest("http://localhost/api/admin/role-quotas"));
    expect(res.status).toBe(200);
  });

  it("ADMIN PUT 更新 USER 配额", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    mocks.upsert.mockResolvedValue({});
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "USER", favoriteLimit: 200 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "USER" } })
    );
  });

  it("非法 role（ADMIN）→ 400", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "ADMIN", favoriteLimit: 999 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("负数配额 → 400", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "USER", favoriteLimit: -5 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
