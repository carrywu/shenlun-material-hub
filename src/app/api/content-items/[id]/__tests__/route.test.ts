import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.getUserFromRequest,
  requireAdmin: authMocks.getUserFromRequest,
  authErrorResponse: () => Response.json({ error: "unauth" }, { status: 401 }),
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockReturnValue(true),
  canModifyResource: vi.fn().mockReturnValue(true),
}));

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { contentItem: { findUnique: mocks.findUnique, update: mocks.update, delete: mocks.delete } },
}));

import { GET } from "../route";

function makeReq(id: string, cookie: string | null) {
  const init: RequestInit = { method: "GET" };
  if (cookie) init.headers = { cookie };
  return [
    new NextRequest(`http://localhost/api/content-items/${id}`, init),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/content-items/[id] — adminReviewStatus (P3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER 访问 pending_admin 文章 → 404（防 ID 绕过）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("VERIFIED_USER 访问 approved 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "approved",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("ADMIN 访问 pending_admin 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });
});
