import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  hashPassword: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  countActiveAdmins: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn() },
}));

const admin = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" as const };
const params = { params: Promise.resolve({ id: "user-1" }) };

describe("PUT /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(admin);
  });

  it("returns 400 for an empty request body instead of throwing JSON parse errors", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(new NextRequest("http://localhost/api/admin/users/user-1", { method: "PUT" }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "请求体必须是 JSON 对象" });
  });

  it("returns 400 for non-object JSON bodies", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PUT",
      body: JSON.stringify([]),
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "请求体必须是 JSON 对象" });
  });
});
