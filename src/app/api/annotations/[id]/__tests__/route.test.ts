import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock users must be defined INSIDE vi.hoisted — external values are not available at hoist time
const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "test-admin", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const USER_A = { id: "user-a-id", username: "userA", role: "USER" as const, status: "ACTIVE" as const };
  const USER_B = { id: "user-b-id", username: "userB", role: "USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, USER_A, USER_B },
    authMocks: {
      requireAdmin: vi.fn().mockResolvedValue(ADMIN),
      requireAuth: vi.fn().mockResolvedValue(ADMIN),
      unauthorizedResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 })
      ),
      forbiddenResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
      ),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    articleAnnotation: {
      findUnique: dbMocks.findUnique,
      update: dbMocks.update,
      delete: dbMocks.delete,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  canModifyResource: vi.fn().mockImplementation(
    (user: { role: string; id: string }, ownerId: string | null) =>
      user.role === "ADMIN" || user.id === ownerId
  ),
}));

import { PATCH, DELETE } from "../route";
import { createAuthenticatedRequest, createAnonymousRequest } from "@/test/helpers/route-helpers";

function setMockUser(user: typeof USERS.ADMIN | null) {
  authMocks.requireAuth.mockResolvedValue(user);
  authMocks.requireAdmin.mockResolvedValue(
    user && user.role === "ADMIN" ? user : null
  );
}

const mockAnnotation = (overrides: Record<string, unknown> = {}) => ({
  id: "ann-1",
  contentItemId: "item-1",
  selectedText: "测试文本",
  comment: "测试批注",
  userId: USERS.USER_A.id,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("PATCH /api/annotations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(USERS.USER_A);
    dbMocks.findUnique.mockResolvedValue(mockAnnotation());
    dbMocks.update.mockResolvedValue(mockAnnotation({ comment: "updated" }));
  });

  it("allows owner to update own annotation", async () => {
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.USER_A,
      { method: "PATCH", body: JSON.stringify({ comment: "updated" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.update).toHaveBeenCalled();
  });

  it("blocks non-owner from updating (403)", async () => {
    setMockUser(USERS.USER_B);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.USER_B,
      { method: "PATCH", body: JSON.stringify({ comment: "hacked" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(403);
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("allows admin to update any annotation", async () => {
    setMockUser(USERS.ADMIN);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.ADMIN,
      { method: "PATCH", body: JSON.stringify({ comment: "admin edit" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.update).toHaveBeenCalled();
  });

  it("blocks regular user from updating null-owner annotation (legacy)", async () => {
    dbMocks.findUnique.mockResolvedValue(mockAnnotation({ userId: null }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.USER_A,
      { method: "PATCH", body: JSON.stringify({ comment: "edit legacy" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent annotation", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-999",
      USERS.USER_A,
      { method: "PATCH", body: JSON.stringify({ comment: "x" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    setMockUser(null);
    const req = createAnonymousRequest(
      "http://localhost/api/annotations/ann-1",
      { method: "PATCH", body: JSON.stringify({ comment: "x" }) }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/annotations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(USERS.USER_A);
    dbMocks.findUnique.mockResolvedValue(mockAnnotation());
    dbMocks.delete.mockResolvedValue(mockAnnotation());
  });

  it("allows owner to delete own annotation", async () => {
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.USER_A,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.delete).toHaveBeenCalled();
  });

  it("blocks non-owner from deleting (403)", async () => {
    setMockUser(USERS.USER_B);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.USER_B,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(403);
    expect(dbMocks.delete).not.toHaveBeenCalled();
  });

  it("allows admin to delete any annotation", async () => {
    setMockUser(USERS.ADMIN);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-1",
      USERS.ADMIN,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(200);
    expect(dbMocks.delete).toHaveBeenCalled();
  });

  it("returns 404 for non-existent annotation", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const req = createAuthenticatedRequest(
      "http://localhost/api/annotations/ann-999",
      USERS.USER_A,
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "ann-999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    setMockUser(null);
    const req = createAnonymousRequest(
      "http://localhost/api/annotations/ann-1",
      { method: "DELETE" }
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "ann-1" }) });
    expect(res.status).toBe(401);
  });
});
