import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: dbMocks.getUserFromRequest,
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findMany: dbMocks.findMany,
      count: dbMocks.count,
    },
  },
}));

const user = { id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" as const };
const admin = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" as const };

describe("GET /api/discover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getUserFromRequest.mockResolvedValue(null);
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.count.mockResolvedValue(0);
  });

  it("keeps the endpoint public but limits anonymous users to public content only", async () => {
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/discover"));

    expect(response.status).toBe(200);
    expect(dbMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        source: {
          verificationStatus: "verified",
          isEnabled: true,
          archivedAt: null,
        },
        visibility: "public",
      },
    }));
  });

  it("uses subscription visibility rules for authenticated users", async () => {
    dbMocks.getUserFromRequest.mockResolvedValueOnce(user);
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/discover?platform=wechat"));

    expect(response.status).toBe(200);
    expect(dbMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        source: {
          verificationStatus: "verified",
          isEnabled: true,
          archivedAt: null,
        },
        platform: "wechat",
        OR: [
          { source: { weweSubscriptions: { some: { userId: "user-1", status: "active" } } } },
          { ownerUserId: "user-1" },
        ],
      },
    }));
  });

  it("does not add a visibility filter for admins", async () => {
    dbMocks.getUserFromRequest.mockResolvedValueOnce(admin);
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/discover"));

    expect(response.status).toBe(200);
    expect(dbMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        source: {
          verificationStatus: "verified",
          isEnabled: true,
          archivedAt: null,
        },
      },
    }));
  });

  it("uses safe pagination fallbacks for malformed input", async () => {
    const { GET } = await import("../route");

    const response = await GET(new NextRequest("http://localhost/api/discover?page=abc&pageSize=xyz"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ page: 1, pageSize: 20, totalPages: 0 });
    expect(dbMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });
});
