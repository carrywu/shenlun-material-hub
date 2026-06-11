import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
  },
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue(null), // role-aware, set per-test
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { contentItem: { findUnique: mocks.findUnique, update: mocks.update } },
}));

import { POST, DELETE } from "../route";

function makeReq(method: string, user: unknown, body?: unknown, query = "") {
  authMocks.requireAdmin.mockResolvedValue(user);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(`http://localhost/api/admin/content-items/feature${query}`, init);
}

describe("feature endpoints (P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER POST → 403", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/admin/content-items/feature", {
      method: "POST",
      headers: { cookie: "auth_token=t", "content-type": "application/json" },
      body: JSON.stringify({ id: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("推送未审核文章 → 400", async () => {
    mocks.findUnique.mockResolvedValue({ id: "x", adminReviewStatus: "pending_admin" });
    const res = await POST(makeReq("POST", USERS.ADMIN, { id: "x" }));
    expect(res.status).toBe(400);
  });

  it("推送 approved 文章 → featuredToday=true", async () => {
    mocks.findUnique.mockResolvedValue({ id: "x", adminReviewStatus: "approved" });
    mocks.update.mockResolvedValue({});
    const res = await POST(makeReq("POST", USERS.ADMIN, { id: "x" }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { featuredToday: true } })
    );
  });

  it("DELETE 撤下 → featuredToday=false", async () => {
    mocks.update.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE", USERS.ADMIN, undefined, "?id=x"));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { featuredToday: false } })
    );
  });
});
