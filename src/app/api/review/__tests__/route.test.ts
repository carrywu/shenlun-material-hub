import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  findUnique: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
  update: vi.fn().mockResolvedValue({ id: "card-1", confirmed: true }),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.getUserFromRequest,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "未登录" }), { status: 401 }),
  forbiddenResponse: () => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      count: mocks.count,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  ownerScopeWhere: (user: { id: string; role: string }) =>
    user.role === "ADMIN" ? {} : { OR: [{ ownerUserId: user.id }, { ownerUserId: null }] },
  mergeWhere: (base: Record<string, unknown>, filter: Record<string, unknown>) => {
    if (!Object.keys(filter).length) return base;
    if (!Object.keys(base).length) return filter;
    return { ...base, ...filter };
  },
}));

const adminUser = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" as const };
const regularUser = { id: "user-a", username: "userA", role: "USER", status: "ACTIVE" as const };

describe("Review API — RBAC isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new Request("http://localhost/api/review"));
    expect(res.status).toBe(401);
  });

  it("should return data for authenticated regular user", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(regularUser);
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new Request("http://localhost/api/review"));
    expect(res.status).toBe(200);
  });

  it("should return data for admin user", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(adminUser);
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new Request("http://localhost/api/review"));
    expect(res.status).toBe(200);
  });

  it("should restrict POST to card owner", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(regularUser);
    mocks.findUnique.mockResolvedValueOnce({
      id: "card-1",
      ownerUserId: "user-b",
      confirmed: false,
    });
    const { POST } = await import("@/app/api/review/route");
    const res = await POST(new Request("http://localhost/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "card-1", confirmed: true }),
    }));
    expect(res.status).toBe(403);
  });

  it("should allow admin to confirm any card", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(adminUser);
    mocks.findUnique.mockResolvedValueOnce({
      id: "card-1",
      ownerUserId: "user-b",
      confirmed: false,
    });
    const { POST } = await import("@/app/api/review/route");
    const res = await POST(new Request("http://localhost/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "card-1", confirmed: true }),
    }));
    expect(res.status).not.toBe(403);
  });
});
