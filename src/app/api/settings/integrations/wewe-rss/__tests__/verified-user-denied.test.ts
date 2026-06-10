import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireVerifiedUser: vi.fn(),
  unauthorizedResponse: vi.fn(),
  forbiddenResponse: vi.fn(),
  userIntegrationUpsert: vi.fn(),
  userIntegrationDeleteMany: vi.fn(),
  userIntegrationUpdate: vi.fn(),
  userIntegrationFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireVerifiedUser: mocks.requireVerifiedUser,
  unauthorizedResponse: mocks.unauthorizedResponse,
  forbiddenResponse: mocks.forbiddenResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    userIntegration: {
      upsert: mocks.userIntegrationUpsert,
      deleteMany: mocks.userIntegrationDeleteMany,
      update: mocks.userIntegrationUpdate,
      findUnique: mocks.userIntegrationFindUnique,
    },
  },
}));

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/settings/integrations/wewe-rss", {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: "auth_token=test-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("WeWe RSS settings — VERIFIED_USER denied on admin-only endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate non-admin: requireAdmin returns null
    mocks.requireAdmin.mockResolvedValue(null);
    mocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 })
    );
    mocks.forbiddenResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
  });

  it("POST returns 403 when user is not admin", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      makeRequest("POST", { baseUrl: "http://localhost:4000" })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toContain("权限不足");
  });

  it("PUT returns 403 when user is not admin", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(
      makeRequest("PUT", { isEnabled: false })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toContain("权限不足");
  });

  it("DELETE returns 403 when user is not admin", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(makeRequest("DELETE"));

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toContain("权限不足");
  });
});
