import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifiedUser = { id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" as const };

const authMocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
}));

const serviceMocks = vi.hoisted(() => ({
  syncToIma: vi.fn(),
  syncBatchToIma: vi.fn(),
  getSyncStatus: vi.fn(),
  getSyncHistory: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);

vi.mock("@/services/ima-sync", () => serviceMocks);

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireVerifiedUser.mockResolvedValue(verifiedUser);
    serviceMocks.getSyncStatus.mockResolvedValue({ id: "sync-1", userId: "user-1" });
    serviceMocks.getSyncHistory.mockResolvedValue([{ id: "sync-1", materialCardId: "card-1", userId: "user-1" }]);
  });

  it("passes the current user when querying a specific sync record", async () => {
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/sync?syncRecordId=sync-1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ id: "sync-1", userId: "user-1" });
    expect(serviceMocks.getSyncStatus).toHaveBeenCalledWith("sync-1", verifiedUser);
  });

  it("passes the current user and safe fallback limit when querying card history", async () => {
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/sync?cardId=card-1&limit=abc"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
    expect(serviceMocks.getSyncHistory).toHaveBeenCalledWith("card-1", verifiedUser, 20);
  });

  it("caps history limit at 100", async () => {
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/sync?cardId=card-1&limit=999"));

    expect(response.status).toBe(200);
    expect(serviceMocks.getSyncHistory).toHaveBeenCalledWith("card-1", verifiedUser, 100);
  });

  it("returns 404 instead of 500 when sync record is inaccessible or missing", async () => {
    serviceMocks.getSyncStatus.mockRejectedValueOnce(new Error("同步记录不存在"));
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/sync?syncRecordId=sync-other"));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ error: "同步记录不存在" });
  });

  it("returns 404 instead of 500 when card history target is inaccessible or missing", async () => {
    serviceMocks.getSyncHistory.mockRejectedValueOnce(new Error("素材卡不存在"));
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/sync?cardId=card-other"));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ error: "素材卡不存在" });
  });
});
