import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  healthCheck: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "未登录" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "无权访问" }, { status: 403 }),
}));

vi.mock("@/services/ima-sync", () => ({
  ImaService: {
    healthCheck: mocks.healthCheck,
  },
}));

import { GET } from "../route";

function request(cookie = "auth_token=t") {
  return new NextRequest("http://localhost/api/ima/health", {
    method: "GET",
    headers: cookie ? { cookie } : undefined,
  });
}

describe("GET /api/ima/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("非管理员不能检查 IMA 健康状态", async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await GET(request());

    expect(res.status).toBe(403);
    expect(mocks.healthCheck).not.toHaveBeenCalled();
  });

  it("管理员可以获取 IMA 健康检查结果", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" });
    mocks.healthCheck.mockResolvedValue({
      configured: true,
      reachable: true,
      authValid: true,
      workspace: "kb-1",
      lastCheckedAt: "2026-06-14T00:00:00.000Z",
    });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mocks.healthCheck).toHaveBeenCalledWith("admin-1");
    await expect(res.json()).resolves.toMatchObject({
      configured: true,
      reachable: true,
      authValid: true,
      workspace: "kb-1",
    });
  });
});
