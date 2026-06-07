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
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findMany: mocks.findMany,
      count: mocks.count,
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
  });

  it("should add visibility filter for anonymous users (public + legacy null)", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/articles");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // P2-14: anonymous users see public + legacy (visibility:null) via mergeWhere
    const { mergeWhere } = await import("@/lib/data-isolation");
    expect(mergeWhere).toHaveBeenCalled();
    // Check that mergeWhere was called with a visibility OR filter
    const lastMergeCall = (mergeWhere as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => {
        const filter = call[1] as Record<string, unknown> | undefined;
        return filter && typeof filter === "object" && "OR" in filter;
      }
    );
    expect(lastMergeCall).toBeDefined();
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
});
