import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
}));

const dbMocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: dbMocks.userUpdate,
    },
  },
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/settings/account", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/settings/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAuth.mockResolvedValue({
      id: "user-1",
      username: "100001",
      displayName: "旧昵称",
      role: "USER",
      status: "ACTIVE",
    });
    dbMocks.userUpdate.mockResolvedValue({
      id: "user-1",
      username: "100001",
      displayName: "新昵称",
      role: "USER",
    });
  });

  it("rejects blank display names", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ displayName: "   " }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("昵称不能为空");
    expect(dbMocks.userUpdate).not.toHaveBeenCalled();
  });

  it("updates the current user's trimmed display name", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ displayName: "  新昵称  " }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({ username: "100001", displayName: "新昵称" });
    expect(dbMocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "新昵称" },
      select: { id: true, username: true, displayName: true, role: true },
    });
  });
});
