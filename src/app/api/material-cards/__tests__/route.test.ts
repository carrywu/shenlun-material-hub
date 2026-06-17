import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = {
    id: "test-admin",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  const USER_A = {
    id: "user-a-id",
    username: "userA",
    role: "USER" as const,
    status: "ACTIVE" as const,
  };
  const VERIFIED = {
    id: "verified-1",
    username: "verified",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, USER_A, VERIFIED },
    authMocks: {
      requireAuth: vi.fn().mockResolvedValue(ADMIN),
      requireVerifiedUser: vi.fn().mockResolvedValue(ADMIN),
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
  requireAuth: authMocks.requireAuth,
  requireVerifiedUser: authMocks.requireVerifiedUser,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
}));

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findMany: dbMocks.findMany,
      count: dbMocks.count,
      findUnique: dbMocks.findUnique,
      create: dbMocks.create,
    },
    contentItem: {
      findUnique: dbMocks.findUnique,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  ownedResourceWhere: vi.fn().mockImplementation(
    (user: { role: string; id: string }) => {
      if (user.role === "ADMIN") return {};
      return { ownerUserId: user.id };
    }
  ),
  mergeWhere: vi.fn().mockImplementation(
    (base: Record<string, unknown>, filter: Record<string, unknown>) => {
      if (!Object.keys(filter).length) return base;
      return { ...base, ...filter };
    }
  ),
  canAccessResource: vi.fn().mockReturnValue(true),
}));

import { GET } from "../route";

describe("GET /api/material-cards — archivedOnly parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAuth.mockResolvedValue(USERS.ADMIN);
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.count.mockResolvedValue(0);
  });

  it("default (no archivedOnly param) excludes archived cards: where.archivedAt = null", async () => {
    const req = new NextRequest("http://localhost/api/material-cards");
    const res = await GET(req);
    expect(res.status).toBe(200);

    // Inspect the where clause passed to findMany
    const lastWhere = dbMocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("archivedAt", null);
  });

  it("archivedOnly=true returns only archived cards: where.archivedAt = { not: null }", async () => {
    const req = new NextRequest("http://localhost/api/material-cards?archivedOnly=true");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const lastWhere = dbMocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("archivedAt");
    expect(lastWhere.archivedAt).toEqual({ not: null });
  });

  it("archivedOnly=false (non-true value) still excludes archived cards", async () => {
    const req = new NextRequest("http://localhost/api/material-cards?archivedOnly=false");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const lastWhere = dbMocks.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(lastWhere).toHaveProperty("archivedAt", null);
  });

  it("returns 401 for unauthenticated request", async () => {
    authMocks.requireAuth.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/material-cards");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/material-cards — P0-5: USER 禁止手动建卡", () => {
  function postBody(contentItemId = "item-1") {
    return new NextRequest("http://localhost/api/material-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "auth_token=t" },
      body: JSON.stringify({
        contentItemId,
        cardType: "金句",
        title: "测试卡",
      }),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.findUnique.mockResolvedValue({
      id: "item-1",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
    });
    dbMocks.create.mockResolvedValue({ id: "card-new" });
  });

  it("USER（普通用户）手动建卡被拒绝（403）", async () => {
    authMocks.requireVerifiedUser.mockResolvedValue(USERS.USER_A);
    const { POST } = await import("../route");
    const res = await POST(postBody());
    expect(res.status).toBe(403);
    expect(dbMocks.create).not.toHaveBeenCalled();
  });

  it("requireVerifiedUser 返回 null（未登录/无权限）→ 401", async () => {
    authMocks.requireVerifiedUser.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(postBody());
    expect(res.status).toBe(401);
    expect(dbMocks.create).not.toHaveBeenCalled();
  });

  it("VERIFIED_USER 可创建自己的卡", async () => {
    authMocks.requireVerifiedUser.mockResolvedValue(USERS.VERIFIED);
    const { POST } = await import("../route");
    const res = await POST(postBody());
    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerUserId: "verified-1" }),
      }),
    );
  });

  it("ADMIN 可创建自己的卡", async () => {
    authMocks.requireVerifiedUser.mockResolvedValue(USERS.ADMIN);
    const { POST } = await import("../route");
    const res = await POST(postBody());
    expect(res.status).toBe(201);
  });
});
