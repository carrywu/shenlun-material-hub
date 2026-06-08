import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
}));

const dbMocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  contentItemCount: vi.fn(),
  contentItemFindMany: vi.fn(),
  contentItemUpdateMany: vi.fn(),
  contentItemDeleteMany: vi.fn(),
  materialCardDeleteMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: dbMocks.queryRaw,
    contentItem: {
      count: dbMocks.contentItemCount,
      findMany: dbMocks.contentItemFindMany,
      updateMany: dbMocks.contentItemUpdateMany,
      deleteMany: dbMocks.contentItemDeleteMany,
    },
    materialCard: {
      deleteMany: dbMocks.materialCardDeleteMany,
    },
  },
}));

const admin = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" as const };

function sqlText(value: unknown): string {
  if (Array.isArray(value) && "raw" in value) return (value.raw as string[]).join("");
  return String(value);
}

describe("/api/admin/clean raw SQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue(admin);
    dbMocks.contentItemCount.mockResolvedValue(0);
    dbMocks.contentItemFindMany.mockResolvedValue([]);
    dbMocks.queryRaw
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }]);
  });

  it("uses quoted PostgreSQL identifiers for clean preview raw queries", async () => {
    const { GET } = await import("../route");

    const response = await GET(new Request("http://localhost/api/admin/clean"));

    expect(response.status).toBe(200);
    const queries = dbMocks.queryRaw.mock.calls.map((call) => sqlText(call[0])).join("\n");
    expect(queries).toContain('FROM "ContentItem"');
    expect(queries).toContain('FROM "MaterialCard"');
    expect(queries).toContain('mc."contentItemId"');
    expect(queries).not.toContain("FROM ContentItem");
    expect(queries).not.toContain("FROM MaterialCard");
  });

  it("uses quoted PostgreSQL identifiers for merge and orphan cleanup raw queries", async () => {
    dbMocks.queryRaw
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/admin/clean", {
      method: "POST",
      body: JSON.stringify({ confirm: true, rules: ["merge_duplicates", "orphan_cards"] }),
    }));

    expect(response.status).toBe(200);
    const queries = dbMocks.queryRaw.mock.calls.map((call) => sqlText(call[0])).join("\n");
    expect(queries).toContain('FROM "ContentItem"');
    expect(queries).toContain('FROM "MaterialCard"');
    expect(queries).toContain('mc."contentItemId"');
    expect(queries).not.toContain("FROM ContentItem");
    expect(queries).not.toContain("FROM MaterialCard");
  });
});
