import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = {
    id: "admin-id",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  const VERIFIED = {
    id: "v",
    username: "v",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  };
  const USER = {
    id: "u",
    username: "u",
    role: "USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, VERIFIED, USER },
    authMocks: {
      requireAuth: vi.fn().mockResolvedValue(null),
      requireAdmin: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.requireAuth,
  requireAdmin: authMocks.requireAdmin,
  authErrorResponse: (req: Request) => {
    const cookie = req.headers.get("cookie") || "";
    if (!cookie.includes("auth_token"))
      return Response.json({ error: "未登录" }, { status: 401 });
    return Response.json({ error: "权限不足" }, { status: 403 });
  },
}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: dbMocks.findUnique,
      create: dbMocks.create,
      findMany: dbMocks.findMany,
      count: dbMocks.count,
    },
    source: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  contentVisibilityWhere: vi.fn().mockReturnValue({}),
  mergeWhere: vi.fn((_a: unknown, b: unknown) => b),
}));

import { POST } from "../route";

function makePostReq(body: Record<string, unknown>, cookie: string | null = "auth_token=t") {
  return new NextRequest("http://localhost/api/content-items", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
    body: JSON.stringify(body),
  });
}

describe("POST /api/content-items — permission (P1-002)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER gets 403 (non-admin cannot import articles)", async () => {
    authMocks.requireAdmin.mockResolvedValue(null); // not admin → null
    authMocks.requireAuth.mockResolvedValue(USERS.VERIFIED); // still authenticated

    const req = makePostReq({
      title: "Test",
      originalUrl: "https://example.com/test",
    });
    const res = await POST(req);

    // requireAdmin returns null for non-admin; authErrorResponse sees cookie → 403
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("权限不足");
  });

  it("USER gets 403 (non-admin cannot import articles)", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.requireAuth.mockResolvedValue(USERS.USER);

    const req = makePostReq({
      title: "Test",
      originalUrl: "https://example.com/test2",
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("unauthenticated request gets 401", async () => {
    authMocks.requireAdmin.mockResolvedValue(null);
    authMocks.requireAuth.mockResolvedValue(null);

    const req = makePostReq(
      { title: "Test", originalUrl: "https://example.com/test3" },
      null // no cookie
    );
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("ADMIN can create content item", async () => {
    authMocks.requireAdmin.mockResolvedValue(USERS.ADMIN);
    dbMocks.findUnique.mockResolvedValue(null); // no duplicate
    dbMocks.create.mockResolvedValue({
      id: "new-id",
      title: "Test Article",
      originalUrl: "https://example.com/test",
    });

    const req = makePostReq({
      title: "Test Article",
      originalUrl: "https://example.com/test",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalled();
  });
});
