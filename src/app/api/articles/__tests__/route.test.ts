import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "test-admin", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const USER_A = { id: "user-a-id", username: "userA", role: "USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, USER_A },
    authMocks: {
      getUserFromRequest: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
}));

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  articleFavoriteFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
    userContentState: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    articleFavorite: {
      findMany: mocks.articleFavoriteFindMany,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  contentVisibilityWhere: vi.fn().mockImplementation(
    (user: { role: string; id: string }) => {
      if (user.role === "ADMIN") return {};
      return { OR: [{ visibility: "public" }, { ownerUserId: user.id }, { ownerUserId: null }] };
    }
  ),
  mergeWhere: vi.fn().mockImplementation(
    (base: Record<string, unknown>, filter: Record<string, unknown>) => {
      if (!Object.keys(filter).length) return base;
      return { ...base, ...filter };
    }
  ),
}));

import { GET } from "../route";

describe("GET /api/articles route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: anonymous user
    authMocks.getUserFromRequest.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.articleFavoriteFindMany.mockResolvedValue([]);
  });

  it("should add visibility filter for anonymous users (approved + public)", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/articles");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // P3-final: 匿名用户只看 adminReviewStatus=approved 且 visibility=public。
    // 注意：原 P2-14 想包含 legacy visibility:null 行，但 schema 里 visibility 是
    // 非空字段（String @default("public")），Prisma 拒绝 visibility:null 条件
    // （→ PrismaClientValidationError → 500）。DB 实测 0 行 visibility IS NULL，
    // 该 OR 条件零命中且致 500，已移除（commit e01a0af）。
    const { mergeWhere } = await import("@/lib/data-isolation");
    expect(mergeWhere).toHaveBeenCalled();
    // 匿名 filter 必须是 approved + public（不再是 OR legacy-null）
    const visibilityCall = (mergeWhere as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => {
        const filter = call[1] as Record<string, unknown> | undefined;
        return (
          filter &&
          typeof filter === "object" &&
          filter.adminReviewStatus === "approved" &&
          filter.visibility === "public"
        );
      }
    );
    expect(visibilityCall).toBeDefined();
  });

  it("should apply visibility filter for authenticated regular user", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER_A);
    const req = new NextRequest("http://localhost/api/articles");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // Should have called contentVisibilityWhere and mergeWhere
    const { contentVisibilityWhere, mergeWhere } = await import("@/lib/data-isolation");
    expect(contentVisibilityWhere).toHaveBeenCalledWith(USERS.USER_A);
    expect(mergeWhere).toHaveBeenCalled();
  });

  it("should not add visibility filter for admin users", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    const req = new NextRequest("http://localhost/api/articles");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // Admin gets empty filter, so where should remain unchanged (no visibility key)
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    // mergeWhere with empty filter returns base as-is, so no visibility key
    expect(lastWhere).not.toHaveProperty("visibility");
  });

  it("should combine keyword search with visibility filter", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER_A);
    const req = new NextRequest("http://localhost/api/articles?keyword=改革");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // mergeWhere should have been called with a where that has OR (search)
    const { mergeWhere } = await import("@/lib/data-isolation");
    expect(mergeWhere).toHaveBeenCalled();
    const [baseArg] = (mergeWhere as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(baseArg).toHaveProperty("OR");
  });

  it("should not filter by platform when sourceType is not provided or is all", async () => {
    const req1 = new NextRequest("http://localhost/api/articles");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    const req2 = new NextRequest("http://localhost/api/articles?sourceType=all");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
  });

  it("should filter by platform=website when sourceType=website", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=website");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("platform", "website");
  });

  it("should filter by platform=wechat when sourceType=wechat", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=wechat");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("platform", "wechat");
  });

  it("should filter by platform not in website/wechat when sourceType=unknown", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=unknown");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("platform", { notIn: ["website", "wechat"] });
  });

  it("should combine sourceType and sourceId filters when both are provided", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=website&sourceId=src-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("platform", "website");
    expect(lastWhere).toHaveProperty("sourceId", "src-1");
  });

  it("ADMIN 传 adminReviewStatus=pending_admin → 应用到 where", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    const req = new NextRequest(
      "http://localhost/api/articles?adminReviewStatus=pending_admin"
    );
    await GET(req);
    // 路由对 ADMIN 会把 adminReviewStatus 写进 where（contentVisibilityWhere 对 ADMIN 返回 {}）
    expect(mocks.findMany).toHaveBeenCalled();
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("adminReviewStatus", "pending_admin");
  });

  it("VERIFIED_USER 传 adminReviewStatus=all → 不应用（强制 approved）", async () => {
    const VERIFIED = {
      id: "v",
      username: "v",
      role: "VERIFIED_USER" as const,
      status: "ACTIVE" as const,
    };
    authMocks.getUserFromRequest.mockResolvedValue(VERIFIED);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    const req = new NextRequest(
      "http://localhost/api/articles?adminReviewStatus=all"
    );
    await GET(req);
    expect(mocks.findMany).toHaveBeenCalled();
    // 非 ADMIN：不能写入 where.adminReviewStatus（由 mock 的 contentVisibilityWhere 保证 approved）
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).not.toHaveProperty("adminReviewStatus");
  });

  it("filter=approved → where.adminReviewStatus=approved", async () => {
    const req = new NextRequest(
      "http://localhost/api/articles?filter=approved"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalled();
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("adminReviewStatus", "approved");
  });

  it("filter=favorites + user with favorites → where.id in favIds", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER_A);
    mocks.articleFavoriteFindMany.mockResolvedValue([
      { contentItemId: "fav-1" },
      { contentItemId: "fav-2" },
    ]);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    const req = new NextRequest(
      "http://localhost/api/articles?filter=favorites"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.articleFavoriteFindMany).toHaveBeenCalledWith({
      where: { userId: USERS.USER_A.id },
      select: { contentItemId: true },
    });
    expect(mocks.findMany).toHaveBeenCalled();
    const lastWhere = mocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("id");
    expect((lastWhere.id as Record<string, unknown>).in).toEqual(["fav-1", "fav-2"]);
  });

  it("filter=favorites + user with no favorites → empty response, no db query", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER_A);
    mocks.articleFavoriteFindMany.mockResolvedValue([]);
    const req = new NextRequest(
      "http://localhost/api/articles?filter=favorites"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });
});
