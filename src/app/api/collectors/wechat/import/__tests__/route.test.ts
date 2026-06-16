import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireAuth: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  validateSession: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  hashPassword: vi.fn().mockResolvedValue("$2a$12$hash"),
  verifyPassword: vi.fn().mockResolvedValue({ valid: true }),
  createSession: vi.fn().mockResolvedValue("test-token"),
  ensureInitialAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);

// Mock db - must use vi.hoisted for variables used in vi.mock
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    source: { findUnique: vi.fn() },
    collectorRun: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock wechat-rss integration (importArticle + getImportTaskStatus + listArticles + FEATURED_MP_ID)
const { mockImportArticle, mockGetImportTaskStatus, mockListArticles, mockFromWeMpRssArticle } = vi.hoisted(() => ({
  mockImportArticle: vi.fn(),
  mockGetImportTaskStatus: vi.fn(),
  mockListArticles: vi.fn(),
  mockFromWeMpRssArticle: vi.fn(),
}));

vi.mock("@/services/integrations/wechat-rss", () => ({
  importArticle: mockImportArticle,
  getImportTaskStatus: mockGetImportTaskStatus,
  listArticles: mockListArticles,
  IMPORT_POLL_TIMEOUT: 120000,
  IMPORT_POLL_INTERVAL: 3000,
  FEATURED_MP_ID: "MP_WXS_FEATURED_ARTICLES",
}));

vi.mock("@/services/collectors/wechat/wechat-article-types", () => ({
  fromWeMpRssArticle: mockFromWeMpRssArticle,
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

  it("应该正确处理有效的微信文章链接（通过 importArticle API）", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    // importArticle 返回异步任务
    mockImportArticle.mockResolvedValue({ taskId: "task-1" });
    // 轮询任务状态：第一次返回 PENDING，第二次返回 SUCCESS
    mockGetImportTaskStatus
      .mockResolvedValueOnce({ taskId: "task-1", status: "PENDING" })
      .mockResolvedValueOnce({ taskId: "task-1", status: "SUCCESS" });
    // listArticles 返回匹配的文章
    mockListArticles.mockResolvedValue({
      list: [{ id: "art-1", url: "https://mp.weixin.qq.com/s/abc123", title: "微信文章" }],
      total: 1,
    });
    // fromWeMpRssArticle 转换
    mockFromWeMpRssArticle.mockReturnValue({
      id: "art-1",
      title: "微信文章",
      url: "https://mp.weixin.qq.com/s/abc123",
      content: "<p>正文</p>",
    });
    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, blocked: 0, errors: [] });

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/abc123"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(1);
    expect(mockImportArticle).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), expect.any(String),
      "https://mp.weixin.qq.com/s/abc123"
    );
  });

  it("应该在 importArticle 失败时返回错误", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockImportArticle.mockRejectedValue(new Error("we-mp-rss 服务不可达"));

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/abc123"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.errors[0]).toContain("we-mp-rss 服务不可达");
  });

  it("应该在异步任务 FAILED 时返回错误", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    mockImportArticle.mockResolvedValue({ taskId: "task-fail" });
    mockGetImportTaskStatus.mockResolvedValueOnce({ taskId: "task-fail", status: "FAILED", message: "文章解析错误" });

    const req = makeRequest({
      urls: ["https://mp.weixin.qq.com/s/abc123"],
      sourceId: "src-wechat-001",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.errors[0]).toContain("导入失败");
    expect(data.errors[0]).toContain("文章解析错误");
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

  it("应该正确更新 CollectorRun 状态（成功）", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);
    mockImportArticle.mockResolvedValue({ taskId: "task-ok" });
    mockGetImportTaskStatus.mockResolvedValueOnce({ taskId: "task-ok", status: "SUCCESS" });
    mockListArticles.mockResolvedValue({ list: [{ id: "a1", url: "https://mp.weixin.qq.com/s/test" }], total: 1 });
    mockFromWeMpRssArticle.mockReturnValue({ id: "a1", title: "文章", url: "https://mp.weixin.qq.com/s/test", content: "<p>内容</p>" });
    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, blocked: 0, errors: [] });

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
    // 第一个 URL 失败（非微信域名），第二个 URL 成功
    mockImportArticle.mockResolvedValue({ taskId: "task-ok" });
    mockGetImportTaskStatus.mockResolvedValueOnce({ taskId: "task-ok", status: "SUCCESS" });
    mockListArticles.mockResolvedValue({ list: [{ id: "a1", url: "https://mp.weixin.qq.com/s/ok" }], total: 1 });
    mockFromWeMpRssArticle.mockReturnValue({ id: "a1", title: "成功", url: "https://mp.weixin.qq.com/s/ok", content: "<p>内容</p>" });
    mockNormalize.mockResolvedValue({ discovered: 1, imported: 1, skipped: 0, blocked: 0, errors: [] });

    const req = makeRequest({
      urls: [
        "https://example.com/fail",  // 非微信域名 → 错误
        "https://mp.weixin.qq.com/s/ok",
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
