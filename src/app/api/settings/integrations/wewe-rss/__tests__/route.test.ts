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
    id: "verified-id",
    username: "verified",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  };
  const USER = {
    id: "user-id",
    username: "plainuser",
    role: "USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, VERIFIED, USER },
    authMocks: {
      getUserFromRequest: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
  requireAdmin: async (req: Request) => {
    const u = await authMocks.getUserFromRequest(req);
    if (!u) return null;
    if (u.role !== "ADMIN") return null;
    return u;
  },
  requireVerifiedUser: async (req: Request) => {
    const u = await authMocks.getUserFromRequest(req);
    if (!u) return null;
    if (u.role !== "ADMIN" && u.role !== "VERIFIED_USER") return null;
    return u;
  },
  unauthorizedResponse: (msg = "未登录或会话已过期") =>
    Response.json({ error: msg }, { status: 401 }),
  forbiddenResponse: (msg = "权限不足") =>
    Response.json({ error: msg }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    userIntegration: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
      update: mocks.update,
    },
  },
}));

vi.mock("@/services/integrations/wewe-rss-api", () => ({
  checkHealth: vi.fn(),
}));

import { GET, POST, DELETE, PUT } from "../route";

function makeRequest(
  method: string,
  cookie: string | null,
  body?: unknown
): NextRequest {
  const init: RequestInit = { method };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(
    "http://localhost/api/settings/integrations/wewe-rss",
    init
  );
}

describe("WeWe RSS settings route — permission lockdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUserFromRequest.mockResolvedValue(null);
  });

  it("GET: 匿名（无 cookie）→ 401", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", null));
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: VERIFIED_USER → 403（收紧后应被拒）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: USER → 403", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: ADMIN → 调用 db 查询（200）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        userId_provider: { userId: "admin-id", provider: "wewe-rss" },
      },
    });
  });

  it("POST: VERIFIED_USER → 403（不写库）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(
      makeRequest("POST", "auth_token=xxx", { baseUrl: "http://x" })
    );
    expect(res.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("DELETE: VERIFIED_USER → 403（不删库）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await DELETE(makeRequest("DELETE", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("PUT: USER → 403（不更新）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const res = await PUT(
      makeRequest("PUT", "auth_token=xxx", { isEnabled: false })
    );
    expect(res.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
