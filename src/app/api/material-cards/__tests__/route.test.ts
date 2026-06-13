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
  return {
    USERS: { ADMIN, USER_A },
    authMocks: {
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
  requireAuth: authMocks.requireAuth,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
}));

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findMany: dbMocks.findMany,
      count: dbMocks.count,
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
