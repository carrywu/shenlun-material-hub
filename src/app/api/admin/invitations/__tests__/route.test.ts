import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, dbMocks, auditMock } = vi.hoisted(() => ({
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" }),
    unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
    forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  },
  dbMocks: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/audit-logger", () => ({ auditLog: auditMock }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      findMany: dbMocks.findMany,
      findUnique: dbMocks.findUnique,
      create: dbMocks.create,
    },
  },
}));

function makeReq(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/invitations", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/admin/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" });
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.findUnique.mockResolvedValue(null);
  });

  it("GET returns status and display counters", async () => {
    dbMocks.findMany.mockResolvedValue([{
      id: "inv-1",
      code: "ABCD1234",
      status: "ACTIVE",
      isEnabled: true,
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 2,
      usedCount: 1,
      expiresAt: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      uses: [],
    }]);

    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.items[0]).toMatchObject({
      code: "ABCD1234",
      status: "ACTIVE",
      remainingUses: 1,
      isDisabled: false,
    });
  });

  it("POST defaults to one use and seven day expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    dbMocks.create.mockResolvedValue({
      id: "inv-2",
      code: "WXYZ5678",
      status: "ACTIVE",
      isEnabled: true,
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 1,
      usedCount: 0,
      expiresAt: new Date("2026-06-22T00:00:00.000Z"),
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({}));

    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        maxUses: 1,
        status: "ACTIVE",
        isEnabled: true,
        expiresAt: new Date("2026-06-22T00:00:00.000Z"),
      }),
    }));
    vi.useRealTimers();
  });

  it("POST supports neverExpires", async () => {
    dbMocks.create.mockResolvedValue({
      id: "inv-3",
      code: "NEVER999",
      status: "ACTIVE",
      isEnabled: true,
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 3,
      usedCount: 0,
      expiresAt: null,
      createdAt: new Date(),
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({ maxUses: 3, neverExpires: true }));

    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ maxUses: 3, expiresAt: null }),
    }));
  });
});
