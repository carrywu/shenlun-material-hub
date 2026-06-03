import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db - must use vi.hoisted for variables used in vi.mock
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    source: { findUnique: vi.fn() },
    collectorRun: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock wechatParser
const { mockParseWechatArticle } = vi.hoisted(() => ({
  mockParseWechatArticle: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/wechatParser", () => ({
  parseWechatArticle: mockParseWechatArticle,
}));

// Mock normalizer
const { mockNormalize } = vi.hoisted(() => ({
  mockNormalize: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/weRssNormalizer", () => ({
  normalizeWeRssArticles: mockNormalize,
}));

import { POST } from "../route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/collectors/wechat/import", {
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
  trustLevel: "verified",
  contentType: "policy_analysis",
};

describe("POST /api/collectors/wechat/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collectorRun.create.mockResolvedValue({ id: "run-import-001" });
    mockDb.collectorRun.update.mockResolvedValue({});
  });

  it("应该拒绝非 mp.weixin.qq.com 链接", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    const req = makeRequest({
      urls: ["https://example.com/article"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200); // 部分失败，整体还是 200
    expect(data.success).toBe(false);
    expect(data.errors[0]).toContain("不支持的链接域名");
  });

  it("应该拒绝无效 URL 格式", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    const req = makeRequest({
      urls: ["not-a-valid-url"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.errors[0]).toContain("无效的链接格式");
  });

  it("应该正确处理有效的微信文章链接", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockParseWechatArticle.mockResolvedValue({
      id: "art-1",
      title: "微信文章",
      url: "https://mp.weixin.qq.com/s/abc123",
      content: "<p>文章正文</p>",
      author: "作者",
      publishTime: "2024-01-01T00:00:00Z",
    });

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/abc123"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(1);
    expect(mockParseWechatArticle).toHaveBeenCalledWith("https://mp.weixin.qq.com/s/abc123");
  });

  it("应该拒绝空 urls 数组", async () => {
    const req = makeRequest({ urls: [], sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("至少一个");
  });

  it("应该拒绝缺少 sourceId 的请求", async () => {
    const req = makeRequest({ urls: ["https://mp.weixin.qq.com/s/test"] });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sourceId");
  });

  it("应该在 source 不存在时返回 404", async () => {
    mockDb.source.findUnique.mockResolvedValue(null);

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/test"],
      sourceId: "nonexistent",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("应该在重复文章时返回 importedCount=0", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockParseWechatArticle.mockResolvedValue({
      id: "art-dup",
      title: "重复文章",
      url: "https://mp.weixin.qq.com/s/dup123",
      content: "<p>重复内容</p>",
    });

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 0, skipped: 1, errors: [] });

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/dup123"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(0);
  });

  it("应该在部分 URL 失败时继续处理其他 URL", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockParseWechatArticle
      .mockRejectedValueOnce(new Error("解析失败"))
      .mockResolvedValueOnce({
        id: "art-ok",
        title: "成功文章",
        url: "https://mp.weixin.qq.com/s/ok123",
        content: "<p>成功内容</p>",
      });

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({
      urls: [
        "https://mp.weixin.qq.com/s/fail123",
        "https://mp.weixin.qq.com/s/ok123",
      ],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(false); // 有错误
    expect(data.importedCount).toBe(1); // 但还是导入了 1 篇
    expect(data.errors).toHaveLength(1);
  });

  it("应该正确更新 CollectorRun 状态（成功）", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);
    mockParseWechatArticle.mockResolvedValue({
      id: "art-1",
      title: "文章",
      url: "https://mp.weixin.qq.com/s/test",
      content: "内容",
    });
    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/test"],
      sourceId: "src-wechat-001",
    });
    await POST(req);

    expect(mockDb.collectorRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "success" }),
      })
    );
  });

  it("应该正确更新 CollectorRun 状态（partial）", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);
    mockParseWechatArticle
      .mockResolvedValueOnce({
        id: "art-ok",
        title: "成功",
        url: "https://mp.weixin.qq.com/s/ok",
        content: "内容",
      })
      .mockRejectedValueOnce(new Error("失败"));

    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, errors: [] });

    const req = makeRequest({
      urls: [
        "https://mp.weixin.qq.com/s/ok",
        "https://mp.weixin.qq.com/s/fail",
      ],
      sourceId: "src-wechat-001",
    });
    await POST(req);

    expect(mockDb.collectorRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partial" }),
      })
    );
  });
});
