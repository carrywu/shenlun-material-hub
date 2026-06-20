import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies - must use vi.hoisted for variables used in vi.mock
const { mockParseURL, mockRunContentFilters } = vi.hoisted(() => ({
  mockParseURL: vi.fn(),
  mockRunContentFilters: vi.fn().mockResolvedValue({ filtered: false }),
}));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    contentItem: { findUnique: vi.fn(), create: vi.fn() },
    collectorRun: { create: vi.fn(), update: vi.fn() },
    collectionChannel: { findMany: vi.fn(), update: vi.fn() },
    source: { update: vi.fn() },
  },
}));

vi.mock("@/lib/rss", () => ({
  parseRssUrl: mockParseURL,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/services/content-filter", () => ({
  runContentFilters: mockRunContentFilters,
}));

// Create a concrete subclass for testing
import { BaseCollector } from "../base";

class TestCollector extends BaseCollector {
  readonly collectorType = "test";
  readonly sourceName = "测试来源";

  async collect() {
    return [];
  }
}

const SOURCE = {
  id: "src-001",
  name: "测试来源",
  platform: "website",
  contentType: "policy_analysis",
  trustLevel: "verified",
};

describe("BaseCollector - RSS 模式", () => {
  let collector: TestCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new TestCollector();
  });

  it("当 urlPattern 为 'rss' 时应该走 RSS 解析", async () => {
    mockParseURL.mockResolvedValue({
      title: "RSS Feed",
      items: [
        {
          title: "RSS 文章",
          link: "https://example.com/article1",
          content: "<p>RSS 全文内容</p>",
          contentSnippet: "RSS 摘要",
          pubDate: "2024-01-01T00:00:00Z",
          creator: "RSS 作者",
        },
      ],
    });

    const channel = {
      id: "ch-001",
      name: "RSS 栏目",
      listUrl: "https://example.com/list",
      urlPattern: "rss",
      paginationPattern: null,
      maxPages: 1,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    expect(mockParseURL).toHaveBeenCalledWith("https://example.com/list");
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("RSS 文章");
    expect(articles[0].url).toBe("https://example.com/article1");
    // 新行为：content:encoded 是 HTML，fullText 转为结构化纯文本，rawHtml 保留 HTML
    expect(articles[0].fullText).toBe("RSS 全文内容");
    expect(articles[0].rawHtml).toBe("<p>RSS 全文内容</p>");
    expect(articles[0].author).toBe("RSS 作者");
  });

  it("当 URL 以 .xml 结尾时应该走 RSS 解析", async () => {
    mockParseURL.mockResolvedValue({
      title: "XML Feed",
      items: [
        {
          title: "XML 文章",
          link: "https://example.com/xml-article",
          contentSnippet: "XML 摘要",
        },
      ],
    });

    const channel = {
      id: "ch-002",
      name: "XML 栏目",
      listUrl: "https://example.com/feed.xml",
      urlPattern: null,
      paginationPattern: null,
      maxPages: 3,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    expect(mockParseURL).toHaveBeenCalledWith("https://example.com/feed.xml");
    expect(articles).toHaveLength(1);
    // XML RSS 模式只取第一页，即使 maxPages > 1
  });

  it("RSS 解析失败时应该向上抛出错误", async () => {
    mockParseURL.mockRejectedValue(new Error("解析 RSS 失败"));

    const channel = {
      id: "ch-003",
      name: "失败栏目",
      listUrl: "https://example.com/bad.xml",
      urlPattern: null,
      paginationPattern: null,
      maxPages: 1,
    };

    await expect(collector.collectFromChannel(channel, SOURCE)).rejects.toThrow("解析 RSS 失败");
  });

  it("RSS 空 feed 应该返回空数组", async () => {
    mockParseURL.mockResolvedValue({
      title: "空 Feed",
      items: [],
    });

    const channel = {
      id: "ch-004",
      name: "空栏目",
      listUrl: "https://example.com/empty.xml",
      urlPattern: null,
      paginationPattern: null,
      maxPages: 1,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    expect(articles).toHaveLength(0);
  });

  it("RSS 文章应该正确映射 publishedAt", async () => {
    mockParseURL.mockResolvedValue({
      title: "日期测试",
      items: [
        {
          title: "有日期",
          link: "https://example.com/dated",
          pubDate: "2024-06-15T10:30:00Z",
        },
        {
          title: "无日期",
          link: "https://example.com/undated",
        },
      ],
    });

    const channel = {
      id: "ch-005",
      name: "日期栏目",
      listUrl: "https://example.com/dates.xml",
      urlPattern: "rss",
      paginationPattern: null,
      maxPages: 1,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    expect(articles[0].publishedAt).toEqual(new Date("2024-06-15T10:30:00Z"));
    expect(articles[1].publishedAt).toBeUndefined();
  });

  it("RSS 文章应该去重（同 URL 只取一次）", async () => {
    mockParseURL.mockResolvedValue({
      title: "重复 Feed",
      items: [
        { title: "文章A", link: "https://example.com/same", content: "A" },
        { title: "文章B", link: "https://example.com/same", content: "B" },
        { title: "文章C", link: "https://example.com/other", content: "C" },
      ],
    });

    const channel = {
      id: "ch-006",
      name: "重复栏目",
      listUrl: "https://example.com/dup.xml",
      urlPattern: "rss",
      paginationPattern: null,
      maxPages: 1,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    expect(articles).toHaveLength(2);
    expect(articles.map((a) => a.url)).toEqual([
      "https://example.com/same",
      "https://example.com/other",
    ]);
  });

  it("RSS 模式下应该使用 content:encoded 作为全文", async () => {
    mockParseURL.mockResolvedValue({
      title: "Content Encoded",
      items: [
        {
          title: "富文本",
          link: "https://example.com/rich",
          "content:encoded": "<p>完整 HTML 正文</p>",
          content: "纯文本",
          contentSnippet: "摘要",
        },
      ],
    });

    const channel = {
      id: "ch-007",
      name: "富文本栏目",
      listUrl: "https://example.com/rich.xml",
      urlPattern: "rss",
      paginationPattern: null,
      maxPages: 1,
    };

    const articles = await collector.collectFromChannel(channel, SOURCE);

    // 新行为：HTML 内容转为结构化纯文本 + 保留 rawHtml
    expect(articles[0].fullText).toBe("完整 HTML 正文");
    expect(articles[0].rawHtml).toBe("<p>完整 HTML 正文</p>");
  });
});
