import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const user = { id: "user-1", username: "user", role: "VERIFIED_USER", status: "ACTIVE" as const };

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  authErrorResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
}));

const dbMocks = vi.hoisted(() => ({
  sourceFindUnique: vi.fn(),
  contentItemFindUnique: vi.fn(),
  contentItemCreate: vi.fn(),
  contentItemFindMany: vi.fn(),
  contentItemCount: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);

vi.mock("@/lib/db", () => ({
  db: {
    source: {
      findUnique: dbMocks.sourceFindUnique,
    },
    contentItem: {
      findUnique: dbMocks.contentItemFindUnique,
      create: dbMocks.contentItemCreate,
      findMany: dbMocks.contentItemFindMany,
      count: dbMocks.contentItemCount,
    },
  },
}));

describe("POST /api/content-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAuth.mockResolvedValue(user);
    dbMocks.sourceFindUnique.mockResolvedValue({
      id: "source-1",
      platform: "wechat",
      contentType: "social_issue",
      trustLevel: "verified_media",
    });
    dbMocks.contentItemFindUnique.mockResolvedValue(null);
    dbMocks.contentItemCreate.mockImplementation(async ({ data }) => ({ id: "item-1", ...data }));
  });

  it("returns 400 when sourceId is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items", {
      method: "POST",
      body: JSON.stringify({ title: "标题", originalUrl: "https://example.com/a" }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "sourceId 为必填项，请传入有效的来源 ID" });
    expect(dbMocks.contentItemCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when sourceId is empty", async () => {
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items", {
      method: "POST",
      body: JSON.stringify({ sourceId: "  ", title: "标题", originalUrl: "https://example.com/a" }),
    }));

    expect(response.status).toBe(400);
    expect(dbMocks.contentItemCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when sourceId does not exist", async () => {
    dbMocks.sourceFindUnique.mockResolvedValueOnce(null);
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items", {
      method: "POST",
      body: JSON.stringify({ sourceId: "missing-source", title: "标题", originalUrl: "https://example.com/a" }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ error: "来源不存在，请传入有效的来源 ID" });
    expect(dbMocks.contentItemCreate).not.toHaveBeenCalled();
  });

  it("uses trimmed originalUrl for duplicate checks", async () => {
    dbMocks.contentItemFindUnique.mockResolvedValueOnce({ id: "existing-item" });
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items", {
      method: "POST",
      body: JSON.stringify({ sourceId: "source-1", title: "标题", originalUrl: "  https://example.com/a  " }),
    }));

    expect(response.status).toBe(409);
    expect(dbMocks.contentItemFindUnique).toHaveBeenCalledWith({ where: { originalUrl: "https://example.com/a" } });
    expect(dbMocks.contentItemCreate).not.toHaveBeenCalled();
  });

  it("creates content with resolved source fields and normalized arrays", async () => {
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items", {
      method: "POST",
      body: JSON.stringify({
        sourceId: " source-1 ",
        title: "  标题  ",
        originalUrl: "  https://example.com/a  ",
        platform: "website",
        contentType: "policy_analysis",
        trustLevel: "unverified",
        excerpt: 123,
        fullText: "正文内容",
        topicTags: { bad: true },
        regionScopes: ["广东"],
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      id: "item-1",
      sourceId: "source-1",
      title: "标题",
      originalUrl: "https://example.com/a",
      platform: "wechat",
      contentType: "social_issue",
      trustLevel: "verified_media",
      excerpt: null,
      fullTextStored: true,
      effectiveTextLength: 4,
      topicTags: "[]",
      regionScopes: JSON.stringify(["广东"]),
    });
    expect(dbMocks.sourceFindUnique).toHaveBeenCalledWith({ where: { id: "source-1" } });
  });
});
