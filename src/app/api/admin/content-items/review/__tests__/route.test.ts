import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: {
      // role-aware: requireAdmin returns user only for ADMIN
      requireAdmin: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const { tx, dbMock } = vi.hoisted(() => {
  const tx = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const dbMock = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) =>
      fn({
        contentItem: { findMany: tx.findMany, updateMany: tx.updateMany },
        materialCard: { deleteMany: tx.deleteMany },
      })
    ),
  };
  return { tx, dbMock };
});
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit-logger", () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "../route";

function makeReq(user: unknown, body: unknown) {
  authMocks.requireAdmin.mockResolvedValue(user);
  return new NextRequest("http://localhost/api/admin/content-items/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/content-items/review (P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null); // non-admin → null → 403/401
    const req = new NextRequest("http://localhost/api/admin/content-items/review", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ ids: ["x"], action: "approve" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("approve 但文章 aiDecision != accept → 400", async () => {
    tx.findMany.mockResolvedValue([{ id: "x", aiDecision: "reject", adminReviewStatus: "rejected" }]);
    const res = await POST(makeReq(USERS.ADMIN, { ids: ["x"], action: "approve" }));
    expect(res.status).toBe(400);
  });

  it("approve（aiDecision=accept）→ 设 approved", async () => {
    tx.findMany.mockResolvedValue([{ id: "x", aiDecision: "accept", adminReviewStatus: "pending_admin" }]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeReq(USERS.ADMIN, { ids: ["x"], action: "approve" }));
    expect(res.status).toBe(200);
    expect(tx.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminReviewStatus: "approved" }),
      })
    );
  });

  it("force-approve（aiDecision=reject + force=true + note）→ 设 approved", async () => {
    tx.findMany.mockResolvedValue([{ id: "x", aiDecision: "reject", adminReviewStatus: "rejected" }]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(
      makeReq(USERS.ADMIN, { ids: ["x"], action: "approve", force: true, note: "AI 误判" })
    );
    expect(res.status).toBe(200);
  });

  it("force-approve 无 note → 400", async () => {
    tx.findMany.mockResolvedValue([{ id: "x", aiDecision: "reject", adminReviewStatus: "rejected" }]);
    const res = await POST(
      makeReq(USERS.ADMIN, { ids: ["x"], action: "approve", force: true })
    );
    expect(res.status).toBe(400);
  });

  it("reject（下架）→ 仅删公共卡(ownerUserId=null) + 清 featuredToday", async () => {
    tx.findMany.mockResolvedValue([{ id: "x", aiDecision: "accept", adminReviewStatus: "approved" }]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    tx.deleteMany.mockResolvedValue({ count: 5 });
    const res = await POST(
      makeReq(USERS.ADMIN, { ids: ["x"], action: "reject", note: "内容过期" })
    );
    expect(res.status).toBe(200);
    expect(tx.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contentItemId: { in: ["x"] }, ownerUserId: null } })
    );
    expect(tx.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminReviewStatus: "rejected", featuredToday: false }),
      })
    );
  });
});
