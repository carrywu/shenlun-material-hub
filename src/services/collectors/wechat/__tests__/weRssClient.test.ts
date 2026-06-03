import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock rss-parser module - must use vi.hoisted for variables used in vi.mock
const { mockParseURL } = vi.hoisted(() => ({
  mockParseURL: vi.fn(),
}));

vi.mock("@/lib/rss", () => ({
  parseRssUrl: mockParseURL,
}));

// Must import after mock
import { fetchStandardRssArticles } from "../weRssClient";

describe("fetchStandardRssArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该正确解析 RSS 2.0 feed", async () => {
    mockParseURL.mockResolvedValue({
      title: "测试公众号",
      items: [
        {
          guid: "abc123",
          title: "第一篇文章",
          link: "https://mp.weixin.qq.com/s/abc123",
          contentSnippet: "这是摘要内容",
          "content:encoded": "<p>这是全文</p>",
          pubDate: "Mon, 01 Jan 2024 00:00:00 +0800",
          creator: "作者名",
        },
        {
          guid: "def456",
          title: "第二篇文章",
          link: "https://mp.weixin.qq.com/s/def456",
          contentSnippet: "第二篇摘要",
          pubDate: "Tue, 02 Jan 2024 12:00:00 +0800",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/feed.xml");

    expect(articles).toHaveLength(2);
    expect(articles[0]).toEqual({
      id: "abc123",
      title: "第一篇文章",
      url: "https://mp.weixin.qq.com/s/abc123",
      content: "<p>这是全文</p>",
      summary: "这是摘要内容",
      author: "作者名",
      publishTime: "Mon, 01 Jan 2024 00:00:00 +0800",
      accountName: "测试公众号",
    });
    expect(articles[1].author).toBe("测试公众号"); // fallback to feed.title
  });

  it("应该正确处理 Atom feed", async () => {
    mockParseURL.mockResolvedValue({
      title: "Atom Feed",
      items: [
        {
          id: "atom1",
          title: "Atom 文章",
          link: "https://mp.weixin.qq.com/s/atom1",
          content: "<p>Atom 全文</p>",
          contentSnippet: "Atom 摘要",
          pubDate: "2024-01-03T10:00:00+08:00",
          creator: "Atom 作者",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/atom.xml");

    expect(articles).toHaveLength(1);
    expect(articles[0].id).toBe("atom1");
    expect(articles[0].content).toBe("<p>Atom 全文</p>");
  });

  it("应该处理缺少 publishTime 的 feed", async () => {
    mockParseURL.mockResolvedValue({
      title: "无日期 Feed",
      items: [
        {
          guid: "nodate1",
          title: "没有日期的文章",
          link: "https://mp.weixin.qq.com/s/nodate1",
          contentSnippet: "无日期摘要",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/no-pubdate.xml");

    expect(articles).toHaveLength(1);
    expect(articles[0].publishTime).toBeUndefined();
  });

  it("应该返回空数组当 feed 没有文章", async () => {
    mockParseURL.mockResolvedValue({
      title: "空 Feed",
      items: [],
    });

    const articles = await fetchStandardRssArticles("https://example.com/empty.xml");

    expect(articles).toHaveLength(0);
  });

  it("应该在 RSS 解析失败时抛出错误", async () => {
    mockParseURL.mockRejectedValue(new Error("解析 RSS 失败: Invalid XML"));

    await expect(
      fetchStandardRssArticles("https://example.com/invalid.xml")
    ).rejects.toThrow("解析 RSS 失败");
  });

  it("应该优先使用 content:encoded 作为 content", async () => {
    mockParseURL.mockResolvedValue({
      title: "富文本 Feed",
      items: [
        {
          guid: "rich1",
          title: "带富文本的文章",
          link: "https://mp.weixin.qq.com/s/rich1",
          contentSnippet: "简短摘要",
          "content:encoded": "<p>完整的 HTML 正文</p>",
          content: "纯文本内容",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/rich.xml");

    expect(articles[0].content).toBe("<p>完整的 HTML 正文</p>");
    expect(articles[0].summary).toBe("简短摘要");
  });

  it("应该在没有 content:encoded 时 fallback 到 content", async () => {
    mockParseURL.mockResolvedValue({
      title: "Fallback Feed",
      items: [
        {
          guid: "fb1",
          title: "Fallback 文章",
          link: "https://mp.weixin.qq.com/s/fb1",
          content: "纯文本正文",
          contentSnippet: "摘要",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/fallback.xml");

    expect(articles[0].content).toBe("纯文本正文");
  });

  it("应该在没有 guid 时使用 link 作为 id", async () => {
    mockParseURL.mockResolvedValue({
      title: "No GUID Feed",
      items: [
        {
          title: "无 GUID 文章",
          link: "https://mp.weixin.qq.com/s/noguid1",
          contentSnippet: "摘要",
        },
      ],
    });

    const articles = await fetchStandardRssArticles("https://example.com/no-guid.xml");

    expect(articles[0].id).toBe("https://mp.weixin.qq.com/s/noguid1");
  });
});
