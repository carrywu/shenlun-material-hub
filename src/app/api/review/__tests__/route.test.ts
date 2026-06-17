import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  findUnique: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
  update: vi.fn().mockResolvedValue({ id: "card-1", confirmed: true }),
  articleReviewStateUpsert: vi.fn().mockResolvedValue({ id: "ars-1" }),
  articleReviewStateFindMany: vi.fn().mockResolvedValue([]),
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
    articleFavorite: {
      findMany: mocks.findMany,
    },
    articleReviewState: {
      upsert: mocks.articleReviewStateUpsert,
      findMany: mocks.articleReviewStateFindMany,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  ownedResourceWhere: (user: { id: string; role: string }) =>
    user.role === "ADMIN" ? {} : { ownerUserId: user.id },
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
    const res = await GET(new NextRequest("http://localhost/api/review"));
    expect(res.status).toBe(401);
  });

  it("should return data for authenticated regular user", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(regularUser);
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new NextRequest("http://localhost/api/review"));
    expect(res.status).toBe(200);
  });

  it("should return data for admin user", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(adminUser);
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new NextRequest("http://localhost/api/review"));
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
    const res = await POST(new NextRequest("http://localhost/api/review", {
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
    const res = await POST(new NextRequest("http://localhost/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "card-1", confirmed: true }),
    }));
    expect(res.status).not.toBe(403);
  });
});

// P1-2: 收藏文章复习闭环（USER 复习收藏文章）
describe("Review API — P1-2 文章复习 (type=article)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET type=article 返回当前用户收藏的 approved 文章", async () => {
    mocks.getUserFromRequest.mockResolvedValue(regularUser);
    mocks.findMany.mockResolvedValueOnce([
      { contentItemId: "art-1", contentItem: { id: "art-1", title: "文章A", adminReviewStatus: "approved" } },
    ]);
    const { GET } = await import("@/app/api/review/route");
    const res = await GET(new NextRequest("http://localhost/api/review?type=article"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("art-1");
  });

  it("POST type=article 记录文章复习状态（upsert ArticleReviewState）", async () => {
    mocks.getUserFromRequest.mockResolvedValue(regularUser);
    const { POST } = await import("@/app/api/review/route");
    const res = await POST(new NextRequest("http://localhost/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "article", contentItemId: "art-1", mastery: 3 }),
    }));
    expect(res.status).toBe(200);
    expect(mocks.articleReviewStateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_contentItemId: { userId: "user-a", contentItemId: "art-1" } },
      }),
    );
  });

  it("POST type=article 缺 contentItemId → 400", async () => {
    mocks.getUserFromRequest.mockResolvedValue(regularUser);
    const { POST } = await import("@/app/api/review/route");
    const res = await POST(new NextRequest("http://localhost/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "article" }),
    }));
    expect(res.status).toBe(400);
  });
});
