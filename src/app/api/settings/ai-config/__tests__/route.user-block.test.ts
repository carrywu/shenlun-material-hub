import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * P8-T6: 回归锁——USER 角色被 AI 配置接口挡。
 *
 * 真实 requireVerifiedUser（src/lib/auth.ts）只放行 ADMIN + VERIFIED_USER，
 * USER 返回 null。此处 mock 还原该语义：通过 getUserFromRequest 返回 USER，
 * requireVerifiedUser 内部判断 role !== ADMIN && role !== VERIFIED_USER → 返回 null。
 * 路由看到 user 为 null 且 cookie 含 auth_token → forbiddenResponse() = 403。
 */
const { authMocks, USERS } = vi.hoisted(() => {
  const USERS = {
    USER: {
      id: "user-id",
      username: "plainuser",
      role: "USER" as const,
      status: "ACTIVE" as const,
    },
  };
  return {
    USERS,
    authMocks: {
      getUserFromRequest: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
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
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { aiConfig: { findFirst: mocks.findFirst, findMany: mocks.findMany } },
}));

import { GET } from "../route";

describe("USER 被 AI 配置接口挡（P8 验证）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("USER GET /api/settings/ai-config → 403", async () => {
    // 真实 requireVerifiedUser 对 USER 返回 null（mock 还原该语义）
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const req = new NextRequest("http://localhost/api/settings/ai-config", {
      headers: { cookie: "auth_token=t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    // 数据库绝不应被触碰——USER 没资格读取 AI 配置
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("USER GET 无 cookie → 401", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const req = new NextRequest("http://localhost/api/settings/ai-config");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
