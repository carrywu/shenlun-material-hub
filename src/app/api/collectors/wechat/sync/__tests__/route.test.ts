import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db - must use vi.hoisted for variables used in vi.mock
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    source: { findUnique: vi.fn(), update: vi.fn() },
    collectorRun: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock WeRssClient
const { mockSyncArticles, mockGetArticles, mockFetchStandardRss } = vi.hoisted(() => ({
  mockSyncArticles: vi.fn(),
  mockGetArticles: vi.fn(),
  mockFetchStandardRss: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/weRssClient", () => {
  return {
    WeRssClient: class MockWeRssClient {
      syncArticles = mockSyncArticles;
      getArticles = mockGetArticles;
    },
    fetchStandardRssArticles: mockFetchStandardRss,
  };
});

// Mock normalizer
const { mockNormalize } = vi.hoisted(() => ({
  mockNormalize: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/weRssNormalizer", () => ({
  normalizeWeRssArticles: mockNormalize,
}));

// Import after mocks
import { POST } from "../route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/collectors/wechat/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SOURCE_RECORD = {
  id: "src-wechat-001",
  name: "测试公众号",
  platform: "wechat",
  isEnabled: true,
  baseUrl: null,
  externalId: null,
  trustLevel: "verified",
  contentType: "policy_analysis",
};

describe("POST /api/collectors/wechat/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collectorRun.create.mockResolvedValue({ id: "run-001" });
    mockDb.collectorRun.update.mockResolvedValue({});
    mockDb.source.update.mockResolvedValue({});
  });

  it("当 targetUrl 是 http 链接时应该走标准 RSS 解析", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "https://example.com/feed.xml",
    });

    mockFetchStandardRss.mockResolvedValue([
      { id: "1", title: "RSS 文章", url: "https://example.com/a1", content: "内容" },
    ]);

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockFetchStandardRss).toHaveBeenCalledWith("https://example.com/feed.xml");
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(1);
  });

  it("当 werssSourceId 是 http 链接时应该走标准 RSS 解析", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockFetchStandardRss.mockResolvedValue([
      { id: "1", title: "文章", url: "https://example.com/a1" },
    ]);

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({
      sourceId: "src-wechat-001",
      werssSourceId: "https://werss.example.com/feed",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockFetchStandardRss).toHaveBeenCalledWith("https://werss.example.com/feed");
  });

  it("当 targetUrl 是短 ID 时应该 fallback 到 WeRSS JSON API", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);
    mockSyncArticles.mockResolvedValue({ synced: 2, articles: [] });
    mockGetArticles.mockResolvedValue({
      articles: [
        { id: "1", title: "内部文章", url: "https://mp.weixin.qq.com/s/internal" },
      ],
      total: 1,
    });
    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSyncArticles).not.toHaveBeenCalled(); // 没有 werssSourceId
    expect(mockGetArticles).toHaveBeenCalledWith("src-wechat-001");
  });

  it("当有 werssSourceId 短 ID 时应该先 sync 再 getArticles", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);
    mockSyncArticles.mockResolvedValue({ synced: 1, articles: [] });
    mockGetArticles.mockResolvedValue({ articles: [], total: 0 });
    mockNormalize.mockResolvedValue({ discovered: 0, imported: 0, skipped: 0, errors: [] });

    const req = makeRequest({
      sourceId: "src-wechat-001",
      werssSourceId: "wxid_abc123",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSyncArticles).toHaveBeenCalledWith("wxid_abc123");
    expect(mockGetArticles).toHaveBeenCalledWith("wxid_abc123");
  });

  it("应该在缺少 sourceId 时返回 400", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sourceId");
  });

  it("应该在 source 不存在时返回 404", async () => {
    mockDb.source.findUnique.mockResolvedValue(null);

    const req = makeRequest({ sourceId: "nonexistent" });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("应该在 source 被禁用时返回 400", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      isEnabled: false,
    });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("禁用");
  });

  it("RSS 解析失败时应该返回 500 并更新 CollectorRun 为 failed", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "https://bad-feed.xml",
    });

    mockFetchStandardRss.mockRejectedValue(new Error("解析 RSS 失败"));

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("解析 RSS 失败");
    expect(mockDb.collectorRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      })
    );
  });

  it("应该在 normalization 有错误时将 CollectorRun 标记为 partial", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "https://example.com/feed.xml",
    });

    mockFetchStandardRss.mockResolvedValue([
      { id: "1", title: "文章1", url: "https://example.com/a1" },
      { id: "2", title: "文章2", url: "https://example.com/a2" },
    ]);

    mockNormalize.mockResolvedValue({
      discovered: 2,
      imported: 1,
      skipped: 0,
      errors: ["[文章2] 数据库错误"],
    });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.importedCount).toBe(1);
    expect(data.errors).toHaveLength(1);

    // CollectorRun 应该标记为 partial
    expect(mockDb.collectorRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partial" }),
      })
    );
  });

  it("localhost RSS URL 应该走标准 RSS 解析", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "http://localhost:4000/feeds/MP_WXS_abc.rss",
    });

    mockFetchStandardRss.mockResolvedValue([
      { id: "1", title: "本地 RSS 文章", url: "https://mp.weixin.qq.com/s/local1" },
    ]);

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockFetchStandardRss).toHaveBeenCalledWith("http://localhost:4000/feeds/MP_WXS_abc.rss");
    expect(data.success).toBe(true);
  });

  it("127.0.0.1 RSS URL 应该走标准 RSS 解析", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "http://127.0.0.1:4000/feeds/MP_WXS_abc.atom",
    });

    mockFetchStandardRss.mockResolvedValue([]);
    mockNormalize.mockResolvedValue({ discovered: 0, imported: 0, skipped: 0, errors: [] });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockFetchStandardRss).toHaveBeenCalledWith("http://127.0.0.1:4000/feeds/MP_WXS_abc.atom");
  });

  it("host.docker.internal RSS URL 应该走标准 RSS 解析", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "http://host.docker.internal:4000/feeds/all.rss",
    });

    mockFetchStandardRss.mockResolvedValue([]);
    mockNormalize.mockResolvedValue({ discovered: 0, imported: 0, skipped: 0, errors: [] });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockFetchStandardRss).toHaveBeenCalledWith("http://host.docker.internal:4000/feeds/all.rss");
  });

  it("重复文章不重复入库（normalize 返回 imported=0）", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      baseUrl: "https://example.com/feed.xml",
    });

    mockFetchStandardRss.mockResolvedValue([
      { id: "1", title: "已存在文章", url: "https://example.com/existing" },
    ]);

    mockNormalize.mockResolvedValue({
      discovered: 1,
      imported: 0,
      skipped: 1,
      errors: [],
    });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(0);
    expect(data.discoveredCount).toBe(1);
  });
});
