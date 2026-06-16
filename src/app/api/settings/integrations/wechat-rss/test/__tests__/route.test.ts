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
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
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

const checkHealthMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/integrations/wechat-rss", () => ({
  checkHealth: checkHealthMock,
}));

import { POST } from "../route";

function makeRequest(cookie: string | null, body?: unknown): NextRequest {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  // NextRequest expects its own RequestInit where signal cannot be null
  const { signal, ...nextInit } = init;
  void signal;
  return new NextRequest(
    "http://localhost/api/settings/integrations/wechat-rss/test",
    nextInit
  );
}

describe("we-mp-rss settings test route — permission lockdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUserFromRequest.mockResolvedValue(null);
  });

  it("匿名 → 401", async () => {
    const res = await POST(makeRequest(null, { baseUrl: "http://x" }));
    expect(res.status).toBe(401);
    expect(checkHealthMock).not.toHaveBeenCalled();
  });

  it("VERIFIED_USER → 403（不调用 checkHealth）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(makeRequest("auth_token=xxx", { baseUrl: "http://x" }));
    expect(res.status).toBe(403);
    expect(checkHealthMock).not.toHaveBeenCalled();
  });

  it("ADMIN → 调用 checkHealth", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    checkHealthMock.mockResolvedValue({ reachable: true, message: "ok", feedCount: 3 });
    const res = await POST(makeRequest("auth_token=xxx", { baseUrl: "http://x" }));
    expect(res.status).toBe(200);
    expect(checkHealthMock).toHaveBeenCalledWith("http://x", "", "");
  });
});
