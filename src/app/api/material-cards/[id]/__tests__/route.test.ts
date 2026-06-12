import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock users must be defined INSIDE vi.hoisted — external values are not available at hoist time
const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "test-admin", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const USER_A = { id: "user-a-id", username: "userA", role: "USER" as const, status: "ACTIVE" as const };
  const USER_B = { id: "user-b-id", username: "userB", role: "USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, USER_A, USER_B },
    authMocks: {
      requireAuth: vi.fn().mockResolvedValue(ADMIN),
      unauthorizedResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 })
      ),
      forbiddenResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
      ),
      authErrorResponse: vi.fn().mockImplementation((req: Request) => {
        const cookieHeader = req.headers.get("cookie") || "";
        if (!cookieHeader.includes("auth_token")) {
          return new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 });
        }
        return new Response(JSON.stringify({ error: "权限不足" }), { status: 403 });
      }),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
  authErrorResponse: authMocks.authErrorResponse,
}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueWithInclude: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findUnique: dbMocks.findUnique,
      update: dbMocks.update,
      delete: dbMocks.delete,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockImplementation(
    (user: { role: string; id: string }, ownerId: string | null) =>
      user.role === "ADMIN" || ownerId === null || user.id === ownerId
  ),
  canModifyResource: vi.fn().mockImplementation(
    (user: { role: string; id: string }, ownerId: string | null) =>
      user.role === "ADMIN" || user.id === ownerId
  ),
}));

import { PUT, DELETE, GET } from "../route";
import { createAuthenticatedRequest, createAnonymousRequest } from "@/test/helpers/route-helpers";

function setMockUser(user: typeof USERS.ADMIN | null) {
  authMocks.requireAuth.mockResolvedValue(user);
}

const mockCard = (overrides: Record<string, unknown> = {}) => ({
  id: "card-1",
  contentItemId: "item-1",
  title: "测试素材卡",
  cardType: "golden_sentence",
  ownerUserId: USERS.USER_A.id,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("PUT /api/material-cards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(USERS.USER_A);
    dbMocks.findUnique.mockResolvedValue(mockCard());
    dbMocks.update.mockResolvedValue(mockCard({ title: "updated" }));
  });

  it("allows owner to edit own card", async () => {
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_A,
      { method: "PUT", body: JSON.stringify({ title: "updated" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.update).toHaveBeenCalled();
  });

  it("blocks non-owner from editing (403)", async () => {
    setMockUser(USERS.USER_B);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_B,
      { method: "PUT", body: JSON.stringify({ title: "hacked" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(403);
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("allows admin to edit any card", async () => {
    setMockUser(USERS.ADMIN);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.ADMIN,
      { method: "PUT", body: JSON.stringify({ title: "admin edit" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.update).toHaveBeenCalled();
  });

  it("blocks regular user from editing null-owner card (legacy)", async () => {
    dbMocks.findUnique.mockResolvedValue(mockCard({ ownerUserId: null }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_A,
      { method: "PUT", body: JSON.stringify({ title: "edit legacy" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent card", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-999",
      USERS.USER_A,
      { method: "PUT", body: JSON.stringify({ title: "x" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    setMockUser(null);
    const req = createAnonymousRequest(
      "http://localhost/api/material-cards/card-1",
      { method: "PUT", body: JSON.stringify({ title: "x" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/material-cards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(USERS.USER_A);
    dbMocks.findUnique.mockResolvedValue(mockCard());
    dbMocks.delete.mockResolvedValue(mockCard());
  });

  it("allows owner to delete own card", async () => {
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_A,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.delete).toHaveBeenCalled();
  });

  it("blocks non-owner from deleting (403)", async () => {
    setMockUser(USERS.USER_B);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_B,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(403);
    expect(dbMocks.delete).not.toHaveBeenCalled();
  });

  it("allows admin to delete any card", async () => {
    setMockUser(USERS.ADMIN);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.ADMIN,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.delete).toHaveBeenCalled();
  });

  it("blocks regular user from deleting null-owner card (legacy)", async () => {
    dbMocks.findUnique.mockResolvedValue(mockCard({ ownerUserId: null }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-1",
      USERS.USER_A,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent card", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const req = createAuthenticatedRequest(
      "http://localhost/api/material-cards/card-999",
      USERS.USER_A,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    setMockUser(null);
    const req = createAnonymousRequest(
      "http://localhost/api/material-cards/card-1",
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(401);
  });
});
