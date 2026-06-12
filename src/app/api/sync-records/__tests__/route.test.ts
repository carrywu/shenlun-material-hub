import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.getUserFromRequest,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "未登录" }), { status: 401 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    syncRecord: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  ownedResourceWhere: (user: { id: string; role: string }, fieldName?: string) =>
    user.role === "ADMIN" ? {} : { [fieldName ?? "ownerUserId"]: user.id },
}));

const adminUser = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" as const };
const userA = { id: "user-a", username: "userA", role: "USER", status: "ACTIVE" as const };

describe("SyncRecords API — RBAC isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/sync-records/route");
    const res = await GET(new NextRequest("http://localhost/api/sync-records"));
    expect(res.status).toBe(401);
  });

  it("should return sync records for authenticated user", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(userA);
    mocks.findMany.mockResolvedValueOnce([{ id: "sr-1", userId: "user-a" }]);
    mocks.count.mockResolvedValueOnce(1);
    const { GET } = await import("@/app/api/sync-records/route");
    const res = await GET(new NextRequest("http://localhost/api/sync-records"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("should return all sync records for admin", async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce(adminUser);
    mocks.findMany.mockResolvedValueOnce([
      { id: "sr-1", userId: "user-a" },
      { id: "sr-2", userId: "admin-1" },
    ]);
    mocks.count.mockResolvedValueOnce(2);
    const { GET } = await import("@/app/api/sync-records/route");
    const res = await GET(new NextRequest("http://localhost/api/sync-records"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
  });
});
