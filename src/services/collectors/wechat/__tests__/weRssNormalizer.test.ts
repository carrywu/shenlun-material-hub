import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WeRssArticle } from "../weRssClient";

// Mock db - must use vi.hoisted for variables used in vi.mock
const { mockFindUnique, mockCreate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

// Mock content-filter
const { mockRunContentFilters } = vi.hoisted(() => ({
  mockRunContentFilters: vi.fn().mockResolvedValue({ filtered: false }),
}));

vi.mock("@/services/content-filter", () => ({
  runContentFilters: mockRunContentFilters,
}));

import { normalizeWeRssArticle, normalizeWeRssArticles } from "../weRssNormalizer";

const BASE_OPTIONS = {
  sourceId: "source-001",
  trustLevel: "verified",
  contentType: "policy_analysis",
};

function makeArticle(overrides: Partial<WeRssArticle> = {}): WeRssArticle {
  return {
    id: "art-1",
    title: "测试文章",
    url: "https://mp.weixin.qq.com/s/test123",
    content: "<p>这是测试正文内容，需要足够长来通过各种过滤器的检查。".repeat(20) + "</p>",
    summary: "测试摘要",
    author: "测试作者",
    publishTime: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeWeRssArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
  });

  it("应该创建新文章并返回 created: true", async () => {
    mockFindUnique.mockResolvedValue(null);
    const createdItem = { id: "new-id", title: "测试文章", originalUrl: "https://mp.weixin.qq.com/s/test123" };
    mockCreate.mockResolvedValue(createdItem);

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(true);
    expect(result.item).toEqual(createdItem);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { originalUrl: "https://mp.weixin.qq.com/s/test123" },
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("应该在文章已存在时返回 created: false", async () => {
    const existing = { id: "existing-id", title: "已有文章", originalUrl: "https://mp.weixin.qq.com/s/test123" };
    mockFindUnique.mockResolvedValue(existing);

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.item).toEqual(existing);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("应该在缺少 URL 时抛出错误", async () => {
    const article = makeArticle({ url: "" });

    await expect(normalizeWeRssArticle(article, BASE_OPTIONS)).rejects.toThrow("缺少 URL");
  });

  it("应该正确计算 contentHash", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle({ content: "test content" }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.contentHash).toBeTruthy();
    expect(createCall.data.contentHash).toHaveLength(16);
  });

  it("应该在没有 content 时标记为 filtered", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const result = await normalizeWeRssArticle(makeArticle({ content: undefined }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.contentHash).toBeNull();
    expect(createCall.data.processingStatus).toBe("filtered");
    expect(createCall.data.qualityStatus).toBe("filtered");
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("无全文内容");
  });

  it("应该在正文过短时标记为 filtered", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const result = await normalizeWeRssArticle(makeArticle({ content: "<p>太短</p>" }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("filtered");
    expect(createCall.data.qualityStatus).toBe("filtered");
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("全文过短");
  });

  it("应该调用 runContentFilters 进行内容过滤", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(mockRunContentFilters).toHaveBeenCalledWith(
      "https://mp.weixin.qq.com/s/test123",
      "测试文章",
      expect.any(String), // fullText
      expect.any(String), // excerpt
      expect.any(String)  // contentHash
    );
  });

  it("应该在 content filter 返回 filtered 时标记文章", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });
    mockRunContentFilters.mockResolvedValue({ filtered: true, reason: "与已有内容重复" });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.filtered).toBe(true);
    expect(result.filterReason).toBe("与已有内容重复");
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("filtered");
    expect(createCall.data.qualityStatus).toBe("filtered");
  });

  it("应该在 content filter 报错时记录错误但不崩溃", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });
    mockRunContentFilters.mockRejectedValue(new Error("DB 连接失败"));

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("内容过滤器执行失败");
    expect(result.filterReason).toContain("DB 连接失败");
    // 文章仍然入库，但标记为 filtered
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("应该在 content filter 通过时设置 processingStatus 为 fetched", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });
    mockRunContentFilters.mockResolvedValue({ filtered: false });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.filtered).toBe(false);
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("fetched");
    expect(createCall.data.qualityStatus).toBe("candidate");
    expect(createCall.data.platform).toBe("wechat");
    expect(createCall.data.discoveryChannel).toBe("werss");
  });

  it("应该正确解析 publishTime", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle({ publishTime: "2024-06-15T10:30:00Z" }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.publishedAt).toEqual(new Date("2024-06-15T10:30:00Z"));
  });

  it("应该在 publishTime 缺少时设置 publishedAt 为 null", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle({ publishTime: undefined }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.publishedAt).toBeNull();
  });

  it("应该保存 coverUrl", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle({ cover: "https://example.com/cover.jpg" }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.coverUrl).toBe("https://example.com/cover.jpg");
  });

  it("应该在没有 cover 时设置 coverUrl 为 null", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    await normalizeWeRssArticle(makeArticle({ cover: undefined }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.coverUrl).toBeNull();
  });
});

describe("normalizeWeRssArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
  });

  it("应该批量处理多篇文章", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/a1", title: "文章1" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/a2", title: "文章2" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/a3", title: "文章3" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(3);
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("应该在部分文章失败时继续处理其他文章", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null) // 第一篇：新建
      .mockRejectedValueOnce(new Error("DB 错误")) // 第二篇：失败
      .mockResolvedValueOnce(null); // 第三篇：新建

    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/b1", title: "成功1" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/b2", title: "失败" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/b3", title: "成功2" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("失败");
  });

  it("应该正确统计跳过的重复文章", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null) // 第一篇：新建
      .mockResolvedValueOnce({ id: "existing" }) // 第二篇：URL 重复
      .mockResolvedValueOnce(null); // 第三篇：新建

    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/c1", title: "新1" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/c2", title: "重复" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/c3", title: "新2" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1); // URL 重复计入 skipped
    expect(result.errors).toHaveLength(0);
  });

  it("应该统计被 content filter 过滤的文章为 skipped", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });
    mockRunContentFilters
      .mockResolvedValueOnce({ filtered: false }) // 第一篇：通过
      .mockResolvedValueOnce({ filtered: true, reason: "与已有内容重复" }) // 第二篇：contentHash 重复
      .mockResolvedValueOnce({ filtered: false }); // 第三篇：通过

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/d1", title: "新1" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/d2", title: "内容重复" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/d3", title: "新2" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1); // contentHash 重复计入 skipped
    expect(result.errors).toHaveLength(0);
  });

  it("两篇不同 URL 相同正文应通过 contentHash 识别重复", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });
    mockRunContentFilters
      .mockResolvedValueOnce({ filtered: false }) // 第一篇：通过
      .mockResolvedValueOnce({ filtered: true, reason: "与已有内容重复（hash: abc123）" }); // 第二篇：重复

    const sameContent = "<p>完全相同的正文内容，用于测试不同 URL 相同正文的 contentHash 去重机制。".repeat(20) + "</p>";
    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/e1", title: "文章A", content: sameContent }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/e2", title: "文章B", content: sameContent }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("空正文应标记为 filtered 并计入 skipped", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/f1", title: "空内容", content: "" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1); // 空正文 → filtered → skipped
  });
});
