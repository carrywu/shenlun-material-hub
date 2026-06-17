import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WechatArticle } from "../wechat-article-types";

// Mock db - must use vi.hoisted for variables used in vi.mock
const { mockFindUnique, mockFindFirst, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn().mockResolvedValue(null),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
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

// Mock logger（normalizeWeRssArticle 各决策分支会写 SystemLog，这里拦截避免打到真实 db）
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { normalizeWeRssArticle, normalizeWeRssArticles, extractPlainText, detectWechatBlockPage } from "../weRssNormalizer";

const BASE_OPTIONS = {
  sourceId: "source-001",
  trustLevel: "verified",
  contentType: "policy_analysis",
};

function makeArticle(overrides: Partial<WechatArticle> = {}): WechatArticle {
  return {
    id: "art-1",
    title: "测试文章",
    url: "https://mp.weixin.qq.com/s/test123",
    content: "<p>这是测试正文内容，需要足够长来通过各种过滤器的检查。".repeat(20) + "</p>",
    summary: "测试摘要",
    author: "测试作者",
    publishTime: "2024-01-01T00:00:00Z",
    hasContent: 1,
    fixFailCount: 0,
    ...overrides,
  };
}

describe("extractPlainText", () => {
  it("应该从 HTML 中提取段落级纯文本", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>console.log("bad");</script>
  <style>body { color: red; }</style>
</head>
<body>
  <div id="js_content">
    <section>
      <p>这是第一段内容。</p>
      <p>这是第二段内容。</p>
    </section>
  </div>
</body>
</html>`;

    const fullText = extractPlainText(html);

    expect(fullText).toContain("这是第一段内容。");
    expect(fullText).toContain("这是第二段内容。");
    expect(fullText).not.toContain("bad");
    expect(fullText).not.toContain("color: red");
  });

  it("当输入不是 HTML 时应该直接返回原文本", () => {
    const text = "这是一段普通的纯文本内容。";
    expect(extractPlainText(text)).toBe(text);
  });

  it("对 null 输入应返回空字符串", () => {
    expect(extractPlainText(null)).toBe("");
  });

  it("对空字符串应返回空字符串", () => {
    expect(extractPlainText("")).toBe("");
  });
});

describe("detectWechatBlockPage", () => {
  it("应该检测包含'环境异常'的封禁页文本", () => {
    expect(detectWechatBlockPage("环境异常 当前环境异常，完成验证后即可继续访问。")).toBe(true);
  });

  it("应该检测包含'验证后即可继续'的封禁页文本", () => {
    expect(detectWechatBlockPage("请完成验证后即可继续访问微信文章")).toBe(true);
  });

  it("应该检测包含'频繁访问'的封禁页文本", () => {
    expect(detectWechatBlockPage("检测到频繁访问，请先验证")).toBe(true);
  });

  it("应该检测包含'为你的访问安全'的封禁页文本", () => {
    expect(detectWechatBlockPage("为你的访问安全，请先验证")).toBe(true);
  });

  it("对空文本应返回 false", () => {
    expect(detectWechatBlockPage(null)).toBe(false);
    expect(detectWechatBlockPage("")).toBe(false);
  });

  it("对正常长文章应返回 false", () => {
    const normalText = "这是一篇正常的微信文章内容，".repeat(20) + "环境异常只是偶然出现的词";
    // 超过 200 字 → 即使包含关键词也返回 false
    expect(detectWechatBlockPage(normalText)).toBe(false);
  });

  it("对正常短文应返回 false", () => {
    expect(detectWechatBlockPage("这是一篇短文")).toBe(false);
  });

  it("对实际线上封禁页清洗结果应返回 true", () => {
    const realBlockedText = "环境异常 当前环境异常，完成验证后即可继续访问。 去验证";
    expect(detectWechatBlockPage(realBlockedText)).toBe(true);
  });
});

describe("normalizeWeRssArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
    mockFindFirst.mockResolvedValue(null);
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

  it("应该在 hasContent===0 时标记为 blocked（Q11 双重检测）", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const result = await normalizeWeRssArticle(makeArticle({ hasContent: 0, content: undefined }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("blocked");
    expect(createCall.data.qualityStatus).toBe("blocked");
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("缺失");
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
    expect(createCall.data.discoveryChannel).toBe("wechat-api"); // D7: werss → wechat-api
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

  it("应该在 fixFailCount>=3 时标记为 blocked", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const result = await normalizeWeRssArticle(makeArticle({ fixFailCount: 3, hasContent: 1 }), BASE_OPTIONS);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("blocked");
    expect(createCall.data.qualityStatus).toBe("blocked");
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("补抓失败");
  });
});

describe("normalizeWeRssArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
    mockFindFirst.mockResolvedValue(null);
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
      makeArticle({ url: "https://mp.weixin.qq.com/s/f1", title: "空内容", content: "", hasContent: 1 }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1); // 空正文 → filtered → skipped
  });
});

describe("normalizeWeRssArticle - 封禁页面检测", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
    mockFindFirst.mockResolvedValue(null);
  });

  it("应该将微信封禁页面标记为 blocked（而非 filtered）", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    // 模拟真实封禁页 HTML → 清洗后为短文本含"环境异常"
    const blockPageHtml = `<!DOCTYPE html><html><body><div class="weui-msg"><h2>环境异常</h2><p>当前环境异常，完成验证后即可继续访问。</p></div></body></html>`;

    const result = await normalizeWeRssArticle(
      makeArticle({ content: blockPageHtml, hasContent: 1 }),
      BASE_OPTIONS,
    );

    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("封禁");
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("blocked");
    expect(createCall.data.qualityStatus).toBe("blocked");
  });

  it("封禁文章不应计入 skipped，应计入 blocked", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const blockPageHtml = `<div><h2>环境异常</h2><p>验证后即可继续访问</p></div>`;
    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/blocked1", content: blockPageHtml, title: "封禁1", hasContent: 1 }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/blocked2", content: blockPageHtml, title: "封禁2", hasContent: 1 }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.blocked).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.imported).toBe(0);
  });

  it("封禁 + 正常文章混合应正确分类计数", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const blockPageHtml = `<div><h2>环境异常</h2><p>验证后即可继续访问</p></div>`;
    const normalContent = "<p>" + "正常文章内容，足够长来通过所有检查。".repeat(30) + "</p>";

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/m1", content: blockPageHtml, title: "封禁", hasContent: 1 }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/m2", content: normalContent, title: "正常", hasContent: 1 }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.blocked).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("hasContent===0 应标记为 blocked（Q11 双重检测第一层）", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "id", title: "t", originalUrl: "u" });

    const result = await normalizeWeRssArticle(
      makeArticle({ hasContent: 0, content: undefined }),
      BASE_OPTIONS,
    );

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.processingStatus).toBe("blocked");
    expect(createCall.data.qualityStatus).toBe("blocked");
    expect(result.filterReason).toContain("缺失");
  });
});

describe("normalizeWeRssArticle — blocked record refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunContentFilters.mockResolvedValue({ filtered: false });
    mockFindFirst.mockResolvedValue(null);
  });

  it("should skip non-blocked existing records (candidate)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "existing-1",
      title: "已存在文章",
      originalUrl: "https://mp.weixin.qq.com/s/test123",
      qualityStatus: "candidate",
      processingStatus: "fetched",
    });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should skip non-blocked existing records (accepted)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "existing-2",
      title: "已接受文章",
      originalUrl: "https://mp.weixin.qq.com/s/test123",
      qualityStatus: "accepted",
      processingStatus: "synced",
    });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should update blocked record when new content is not blocked", async () => {
    const blockedRecord = {
      id: "blocked-1",
      title: "被封禁的文章",
      originalUrl: "https://mp.weixin.qq.com/s/test123",
      qualityStatus: "blocked",
      processingStatus: "blocked",
      coverUrl: "https://example.com/old-cover.jpg",
      aiDecision: "reject",
      aiReason: "旧评估",
      aiAssessedAt: new Date("2024-01-01"),
      aiScore: 3.5,
      aiScoreDetail: "{}",
      aiScoredAt: new Date("2024-01-01"),
      aiAssessmentError: null,
    };

    mockFindUnique.mockResolvedValue(blockedRecord);
    mockUpdate.mockResolvedValue({
      ...blockedRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
    });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(false);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "blocked-1" },
        data: expect.objectContaining({
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          aiDecision: null,
          aiAssessedAt: null,
        }),
      })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should NOT update blocked record when new content is still blocked", async () => {
    const blockedRecord = {
      id: "blocked-2",
      title: "仍被封禁的文章",
      originalUrl: "https://mp.weixin.qq.com/s/still-blocked",
      qualityStatus: "blocked",
      processingStatus: "blocked",
    };

    mockFindUnique.mockResolvedValue(blockedRecord);

    // Article content is a WeChat block page
    const blockArticle = makeArticle({
      url: "https://mp.weixin.qq.com/s/still-blocked",
      content: "<p>当前环境异常，请先验证后即可继续访问</p>",
      hasContent: 1,
    });

    const result = await normalizeWeRssArticle(blockArticle, BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should clear all AI fields when refreshing blocked record", async () => {
    const blockedRecord = {
      id: "blocked-3",
      title: "有AI评估的封禁文章",
      originalUrl: "https://mp.weixin.qq.com/s/test123",
      qualityStatus: "blocked",
      processingStatus: "blocked",
      aiDecision: "accept",
      aiReason: "旧原因",
      aiAssessedAt: new Date("2024-01-01"),
      aiScore: 8.5,
      aiScoreDetail: '{"relevance":9}',
      aiScoredAt: new Date("2024-01-01"),
      aiAssessmentError: null,
      contentGenre: "commentary",
      aiCategories: '["cat1"]',
      aiUsableFor: '["use1"]',
      aiSummary: "旧摘要",
      aiQuotes: '["旧金句"]',
    };

    mockFindUnique.mockResolvedValue(blockedRecord);
    mockUpdate.mockResolvedValue({
      ...blockedRecord,
      qualityStatus: "pending",
    });

    await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({
      aiDecision: null,
      aiReason: null,
      aiAssessedAt: null,
      aiAssessmentError: null,
      aiScore: null,
      aiScoreDetail: null,
      aiScoredAt: null,
      contentGenre: null,
      aiCategories: null,
      aiUsableFor: null,
      aiSummary: null,
      aiQuotes: null,
      adminReviewStatus: "pending_ai",
    });
  });

  it("should count refreshed blocked articles in normalizeWeRssArticles", async () => {
    const blockedRecord = {
      id: "blocked-batch",
      title: "封禁文章",
      originalUrl: "https://mp.weixin.qq.com/s/refresh1",
      qualityStatus: "blocked",
      processingStatus: "blocked",
    };

    mockFindUnique
      .mockResolvedValueOnce(null) // first article: new
      .mockResolvedValueOnce(blockedRecord); // second article: blocked → refresh

    mockCreate.mockResolvedValue({ id: "new-id", title: "t", originalUrl: "u" });
    mockUpdate.mockResolvedValue({
      ...blockedRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
    });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/refresh-new", title: "新文章" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/refresh1", title: "封禁刷新" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("should update filtered record with 无全文内容 when new content is available", async () => {
    const filteredRecord = {
      id: "filtered-1",
      title: "之前无内容的文章",
      originalUrl: "https://mp.weixin.qq.com/s/test123",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "无全文内容（采集器未获取到正文）",
      coverUrl: "https://example.com/old-cover.jpg",
      aiDecision: null,
      aiReason: null,
      aiAssessedAt: null,
      aiScore: null,
      aiScoreDetail: null,
      aiScoredAt: null,
      aiAssessmentError: null,
    };

    mockFindUnique.mockResolvedValue(filteredRecord);
    mockUpdate.mockResolvedValue({
      ...filteredRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
      filterReason: null,
    });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(false);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "filtered-1" },
        data: expect.objectContaining({
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          fullTextStored: true,
        }),
      })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should NOT update filtered record when new content is still too short", async () => {
    const filteredRecord = {
      id: "filtered-2",
      title: "过短文章",
      originalUrl: "https://mp.weixin.qq.com/s/short123",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "全文过短（26 字），不足 300 字",
    };

    mockFindUnique.mockResolvedValue(filteredRecord);

    // Article content is still very short (< 300 chars)
    const shortArticle = makeArticle({
      url: "https://mp.weixin.qq.com/s/short123",
      content: "<p>短内容</p>",
      hasContent: 1,
    });

    const result = await normalizeWeRssArticle(shortArticle, BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toBe("全文过短（26 字），不足 300 字");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should NOT update filtered record when new content is still empty", async () => {
    const filteredRecord = {
      id: "filtered-3",
      title: "无内容文章",
      originalUrl: "https://mp.weixin.qq.com/s/empty123",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "无全文内容（采集器未获取到正文）",
    };

    mockFindUnique.mockResolvedValue(filteredRecord);

    // Article still has no content
    const emptyArticle = makeArticle({
      url: "https://mp.weixin.qq.com/s/empty123",
      content: null,
      rawHtml: null,
      hasContent: 0,
    });

    const result = await normalizeWeRssArticle(emptyArticle, BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toBe("无全文内容（采集器未获取到正文）");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should count refreshed filtered articles in normalizeWeRssArticles", async () => {
    const filteredRecord = {
      id: "filtered-batch",
      title: "之前无内容",
      originalUrl: "https://mp.weixin.qq.com/s/refresh-filtered",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "无全文内容（采集器未获取到正文）",
    };

    mockFindUnique
      .mockResolvedValueOnce(null) // first article: new
      .mockResolvedValueOnce(filteredRecord); // second article: filtered → refresh

    mockCreate.mockResolvedValue({ id: "new-id", title: "t", originalUrl: "u" });
    mockUpdate.mockResolvedValue({
      ...filteredRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
    });

    const articles = [
      makeArticle({ url: "https://mp.weixin.qq.com/s/refresh-new", title: "新文章" }),
      makeArticle({ url: "https://mp.weixin.qq.com/s/refresh-filtered", title: "之前无内容" }),
    ];

    const result = await normalizeWeRssArticles(articles, BASE_OPTIONS);

    expect(result.discovered).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("should update filtered record with 疑似导航页面 when new content is sufficient", async () => {
    const filteredRecord = {
      id: "nav-filtered-1",
      title: "被导航过滤器误杀的文章",
      originalUrl: "https://mp.weixin.qq.com/s/nav123",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "疑似导航页面（81% 行为短文本，共 275 行）",
      coverUrl: "https://example.com/old-cover.jpg",
      aiDecision: null,
      aiReason: null,
      aiAssessedAt: null,
      aiScore: null,
      aiScoreDetail: null,
      aiScoredAt: null,
      aiAssessmentError: null,
    };

    mockFindUnique.mockResolvedValue(filteredRecord);
    mockUpdate.mockResolvedValue({
      ...filteredRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
      filterReason: null,
    });

    const result = await normalizeWeRssArticle(makeArticle(), BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(false);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "nav-filtered-1" },
        data: expect.objectContaining({
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          fullTextStored: true,
        }),
      })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should NOT update filtered record with 疑似导航页面 when new content is still too short", async () => {
    const filteredRecord = {
      id: "nav-filtered-2",
      title: "被导航过滤器误杀的短文章",
      originalUrl: "https://mp.weixin.qq.com/s/nav-short",
      qualityStatus: "filtered",
      processingStatus: "filtered",
      filterReason: "疑似导航页面（81% 行为短文本，共 275 行）",
    };

    mockFindUnique.mockResolvedValue(filteredRecord);

    // Article content is still very short (< 300 chars)
    const shortArticle = makeArticle({
      url: "https://mp.weixin.qq.com/s/nav-short",
      content: "<p>短内容</p>",
      hasContent: 1,
    });

    const result = await normalizeWeRssArticle(shortArticle, BASE_OPTIONS);

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toBe("疑似导航页面（81% 行为短文本，共 275 行）");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  describe("hard duplicate with forceReimport", () => {
    it("should update existing record when forceReimport is true", async () => {
      const existingRecord = {
        id: "existing-force-1",
        title: "已存在的非封禁文章",
        originalUrl: "https://mp.weixin.qq.com/s/test123",
        qualityStatus: "pending",
        processingStatus: "fetched",
        coverUrl: "https://example.com/old-cover.jpg",
        aiDecision: "relevant",
        aiReason: "旧评估原因",
        aiAssessedAt: new Date("2024-01-01"),
        aiScore: 85,
        aiScoreDetail: '{"relevance":9}',
        aiScoredAt: new Date("2024-01-01"),
        aiAssessmentError: null,
        contentGenre: "commentary",
        aiCategories: ["政策解读"],
        aiUsableFor: ["素材"],
        aiSummary: "旧摘要",
        aiQuotes: ["旧引用"],
      };

      mockFindUnique.mockResolvedValue(existingRecord);
      mockUpdate.mockResolvedValue({
        ...existingRecord,
        qualityStatus: "pending",
        processingStatus: "fetched",
        filterReason: null,
        aiDecision: null,
        aiScore: null,
      });

      const result = await normalizeWeRssArticle(
        makeArticle(),
        { ...BASE_OPTIONS, forceReimport: true },
      );

      expect(result.created).toBe(false);
      expect(result.filtered).toBe(false);
      expect(result.filterReason).toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "existing-force-1" },
          data: expect.objectContaining({
            qualityStatus: "pending",
            processingStatus: "fetched",
            filterReason: null,
            aiDecision: null,
            aiReason: null,
            aiAssessedAt: null,
            aiScore: null,
            aiScoreDetail: null,
            aiScoredAt: null,
            contentGenre: null,
            aiCategories: null,
            aiUsableFor: null,
            aiSummary: null,
            aiQuotes: null,
            adminReviewStatus: "pending_ai",
          }),
        }),
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should skip existing record when forceReimport is false (default)", async () => {
      const existingRecord = {
        id: "existing-skip-1",
        title: "已存在的非封禁文章",
        originalUrl: "https://mp.weixin.qq.com/s/test123",
        qualityStatus: "pending",
        processingStatus: "fetched",
        fullText: "old content that should remain unchanged",
      };

      mockFindUnique.mockResolvedValue(existingRecord);

      const result = await normalizeWeRssArticle(
        makeArticle(),
        BASE_OPTIONS,
      );

      expect(result.created).toBe(false);
      expect(result.filtered).toBe(true);
      expect(result.filterReason).toBe("URL 已存在（重复）");
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should count forceReimport updated records as refreshed in batch", async () => {
      const existingRecord = {
        id: "existing-batch-1",
        title: "已存在文章",
        originalUrl: "https://mp.weixin.qq.com/s/refresh-force",
        qualityStatus: "accepted",
        processingStatus: "synced",
      };

      mockFindUnique.mockResolvedValue(existingRecord);
      mockUpdate.mockResolvedValue({
        ...existingRecord,
        qualityStatus: "pending",
        processingStatus: "fetched",
      });

      const articles = [
        makeArticle({ url: "https://mp.weixin.qq.com/s/refresh-force", title: "强制刷新" }),
      ];

      const result = await normalizeWeRssArticles(articles, { ...BASE_OPTIONS, forceReimport: true });

      expect(result.discovered).toBe(1);
      expect(result.refreshed).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });
});
