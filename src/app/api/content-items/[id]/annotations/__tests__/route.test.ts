import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAuthenticatedRequest, createAnonymousRequest } from "@/test/helpers/route-helpers";

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

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockImplementation(
    (user: { role: string; id: string }, ownerId: string | null, visibility?: string) =>
      user.role === "ADMIN" || ownerId === null || ownerId === user.id || visibility === "public"
  ),
  // P1-001: ownedResourceWhere — non-admin sees only own data, no legacy null
  ownedResourceWhere: vi.fn().mockImplementation(
    (user: { role: string; id: string }, fieldName?: string) =>
      user.role === "ADMIN" ? {} : { [fieldName ?? "ownerUserId"]: user.id }
  ),
}));

vi.mock("@/services/ai-annotation", () => ({
  generateAnnotation: vi.fn(),
  autoAnnotateArticle: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { findUnique: dbMocks.findUnique },
    articleAnnotation: { findMany: dbMocks.findMany, create: dbMocks.create },
  },
}));

import { GET } from "../route";

function setMockUser(user: typeof USERS.ADMIN | typeof USERS.USER_A | typeof USERS.USER_B | null) {
  authMocks.requireAuth.mockResolvedValue(user);
  authMocks.requireAdmin.mockResolvedValue(
    user && user.role === "ADMIN" ? user : null
  );
}

const mockItem = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  title: "测试文章",
  ownerUserId: USERS.USER_A.id,
  visibility: "public",
  ...overrides,
});

const mockAnnotations = [
  { id: "ann-1", contentItemId: "item-1", userId: USERS.USER_A.id, comment: "A的批注" },
  { id: "ann-2", contentItemId: "item-1", userId: null, comment: "历史批注" },
  { id: "ann-3", contentItemId: "item-1", userId: USERS.USER_B.id, comment: "B的批注" },
];

describe("GET /api/content-items/[id]/annotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(USERS.USER_A);
    dbMocks.findUnique.mockResolvedValue(mockItem());
    dbMocks.findMany.mockResolvedValue(mockAnnotations);
  });

  it("returns 401 for unauthenticated request", async () => {
    setMockUser(null);
    const req = createAnonymousRequest("http://localhost/api/content-items/item-1/annotations");
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent content item", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-999/annotations",
      USERS.USER_A
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-999" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user cannot access private item", async () => {
    dbMocks.findUnique.mockResolvedValue(mockItem({ ownerUserId: USERS.USER_B.id, visibility: "private" }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-1/annotations",
      USERS.USER_A
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(403);
  });

  it("allows access to public item", async () => {
    dbMocks.findUnique.mockResolvedValue(mockItem({ ownerUserId: USERS.USER_B.id, visibility: "public" }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-1/annotations",
      USERS.USER_A
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(200);
  });

  it("allows owner access to private item", async () => {
    dbMocks.findUnique.mockResolvedValue(mockItem({ ownerUserId: USERS.USER_A.id, visibility: "private" }));
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-1/annotations",
      USERS.USER_A
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(200);
  });

  it("ADMIN sees all annotations regardless of ownership", async () => {
    setMockUser(USERS.ADMIN);
    dbMocks.findUnique.mockResolvedValue(mockItem());
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-1/annotations",
      USERS.ADMIN
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(200);
    // Admin query should not filter by userId
    const findManyCall = dbMocks.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(findManyCall.where).toEqual({ contentItemId: "item-1" });
  });

  it("P1-001: regular user sees only own annotations (no legacy null)", async () => {
    const req = createAuthenticatedRequest(
      "http://localhost/api/content-items/item-1/annotations",
      USERS.USER_A
    );
    const res = await GET(req, { params: Promise.resolve({ id: "item-1" }) });
    expect(res.status).toBe(200);
    // P1-001: Non-admin query should filter by userId only (no OR with null)
    const findManyCall = dbMocks.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(findManyCall.where.contentItemId).toBe("item-1");
    expect(findManyCall.where).toHaveProperty("userId", USERS.USER_A.id);
    // Must NOT have OR clause that includes legacy null-owner data
    expect(findManyCall.where).not.toHaveProperty("OR");
  });
});
