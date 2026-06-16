import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Auth mock ──────────────────────────────────────────────────────────

const { authMocks } = vi.hoisted(() => ({
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id", username: "admin", role: "ADMIN", status: "ACTIVE" }),
    unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
    forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  },
}));

vi.mock("@/lib/auth", () => authMocks);

// ── Integration mock ─────────────────────────────────────────────────

const { mockCheckHealth, mockGetContentHealth, mockListFeeds, mockCheckSqliteDb, mockTriggerFeedSync, mockListArticles, mockListFeedsAuto } = vi.hoisted(() => ({
  mockCheckHealth: vi.fn(),
  mockGetContentHealth: vi.fn(),
  mockListFeeds: vi.fn(),
  mockCheckSqliteDb: vi.fn(),
  mockTriggerFeedSync: vi.fn(),
  mockListArticles: vi.fn(),
  mockListFeedsAuto: vi.fn(),
}));

vi.mock("@/services/integrations/wechat-rss", () => ({
  checkHealth: mockCheckHealth,
  getContentHealth: mockGetContentHealth,
  listFeeds: mockListFeeds,
  FEATURED_MP_ID: "MP_WXS_FEATURED_ARTICLES",
  SYNC_ARTICLE_LIMIT: 100,
  AUTH_EXPIRED_RATIO: 0.5,
  REFRESH_RATE_LIMIT_S: 60,
  checkSqliteDb: mockCheckSqliteDb,
  triggerFeedSync: mockTriggerFeedSync,
  listArticles: mockListArticles,
  listFeedsAuto: mockListFeedsAuto,
}));

// ── DB mock ────────────────────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    source: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userIntegration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// ── Normalizer mock ───────────────────────────────────────────────────

const { mockNormalizeWeRssArticles } = vi.hoisted(() => ({
  mockNormalizeWeRssArticles: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/weRssNormalizer", () => ({
  normalizeWeRssArticles: mockNormalizeWeRssArticles,
}));

const { mockFromWeMpRssArticle } = vi.hoisted(() => ({
  mockFromWeMpRssArticle: vi.fn(),
}));

vi.mock("@/services/collectors/wechat/wechat-article-types", () => ({
  fromWeMpRssArticle: mockFromWeMpRssArticle,
}));

// ── Status route ──────────────────────────────────────────────────────

describe("GET /api/integrations/wechat-rss/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WE_MP_RSS_BASE_URL = "http://localhost:8001";
    process.env.WE_MP_RSS_ACCESS_KEY = "ak";
    process.env.WE_MP_RSS_SECRET_KEY = "sk";
  });

  it("应返回 we-mp-rss 连接状态和 authStatus", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      reachable: true,
      message: "ok",
      feedCount: 3,
      authStatus: "valid",
    });
    mockCheckSqliteDb.mockResolvedValueOnce({ exists: true, readable: true, message: "可读", path: "/tmp/db" });
    mockListFeeds.mockResolvedValueOnce({ list: [{ id: "mp1", mpName: "测试" }], total: 1 });
    mockGetContentHealth.mockResolvedValueOnce({ totalArticles: 10, missingContent: 1, ratio: 0.1 });

    const { GET } = await import("../status/route");
    const res = await GET(new Request("http://localhost/api/integrations/wechat-rss/status"));
    const data = await res.json();

    expect(data.reachable).toBe(true);
    expect(data.authStatus).toBe("valid");
    expect(data.akskConfigured).toBe(true);
    expect(data.channels.api.available).toBe(true);
    expect(data.channels.sqlite.available).toBe(true);
  });

  it("未登录应返回 401", async () => {
    authMocks.requireAdmin.mockResolvedValueOnce(null);
    const { GET } = await import("../status/route");
    const res = await GET(new Request("http://localhost/api/integrations/wechat-rss/status"));
    expect(res.status).toBe(401);
  });

  it("authStatus 应降级为 expired 当 content 缺失比例过高", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      reachable: true,
      message: "ok",
      feedCount: 3,
      authStatus: "valid",
    });
    mockCheckSqliteDb.mockResolvedValueOnce({ exists: false, readable: false });
    mockListFeeds.mockResolvedValueOnce({ list: [{ id: "mp1", mpName: "测试" }], total: 1 });
    mockGetContentHealth.mockResolvedValueOnce({ totalArticles: 10, missingContent: 6, ratio: 0.6 });

    const { GET } = await import("../status/route");
    const res = await GET(new Request("http://localhost/api/integrations/wechat-rss/status"));
    const data = await res.json();

    expect(data.authStatus).toBe("expired");
  });
});

// ── Test route ────────────────────────────────────────────────────────

describe("POST /api/integrations/wechat-rss/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应调用 checkHealth 并返回结果", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      reachable: true,
      message: "ok",
      feedCount: 2,
      authStatus: "valid",
    });
    mockListFeeds.mockResolvedValueOnce({
      list: [{ id: "mp1", mpName: "测试" }],
      total: 1,
    });

    const { POST } = await import("../test/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001", accessKey: "ak", secretKey: "sk" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.feedCount).toBe(1);
    expect(mockCheckHealth).toHaveBeenCalledWith("http://x:8001", "ak", "sk");
  });

  it("缺少 baseUrl 应返回 400", async () => {
    const { POST } = await import("../test/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("服务不可达应返回失败", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      reachable: false,
      message: "ECONNREFUSED",
      authStatus: "unknown",
    });

    const { POST } = await import("../test/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(false);
  });
});

// ── Preview-sync route ────────────────────────────────────────────────

describe("POST /api/integrations/wechat-rss/preview-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应返回分类结果（toCreate/toUpdate/toDelete）", async () => {
    mockListFeedsAuto.mockResolvedValueOnce({
      feeds: [
        { id: "mp1", mpName: "人民日报" },
        { id: "mp2", mpName: "新华社" },
      ],
      source: "api",
      message: "从 API 读取到 2 个公众号",
    });
    mockDb.source.findMany.mockResolvedValueOnce([
      { id: "s1", feedId: "mp1", name: "人民日报旧名", baseUrl: "http://x", isEnabled: true },
      { id: "s2", feedId: "mp3", name: "已删除", baseUrl: "http://x", isEnabled: true },
    ]);

    const { POST } = await import("../preview-sync/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/preview-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.toCreate).toHaveLength(1); // mp2 新增
    expect(data.toUpdate).toHaveLength(1); // mp1 名字变了
    expect(data.toDelete).toHaveLength(1); // mp3 缺失
  });

  it("FEATURED_MP_ID 不应出现在 toDelete 中（Q15）", async () => {
    mockListFeedsAuto.mockResolvedValueOnce({
      feeds: [],
      source: "api",
      message: "空列表",
    });
    mockDb.source.findMany.mockResolvedValueOnce([
      { id: "s1", feedId: "MP_WXS_FEATURED_ARTICLES", name: "精选文章", baseUrl: "", isEnabled: true },
    ]);

    const { POST } = await import("../preview-sync/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/preview-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.toDelete).toHaveLength(0);
  });
});

// ── Sync-sources route ───────────────────────────────────────────────

describe("POST /api/integrations/wechat-rss/sync-sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应创建新来源并更新已有来源", async () => {
    mockListFeedsAuto.mockResolvedValueOnce({
      feeds: [
        { id: "mp1", mpName: "人民日报" },
        { id: "mp2", mpName: "新华社" },
      ],
      source: "api",
      message: "ok",
    });
    mockDb.source.findMany.mockResolvedValueOnce([
      { id: "s1", feedId: "mp1", name: "人民日报", baseUrl: "http://x" },
    ]);
    mockDb.source.create.mockResolvedValueOnce({ id: "s2" });
    mockDb.source.update.mockResolvedValueOnce({ id: "s1" });

    const { POST } = await import("../sync-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/sync-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.created).toBe(1); // mp2
    expect(data.skipped).toBe(1); // mp1 名字没变
  });

  it("空列表应返回成功", async () => {
    mockListFeedsAuto.mockResolvedValueOnce({
      feeds: [],
      source: "api",
      message: "没有公众号",
    });

    const { POST } = await import("../sync-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/sync-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://x:8001" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.created).toBe(0);
  });
});

// ── Refresh-source route ───────────────────────────────────────────────

describe("POST /api/integrations/wechat-rss/refresh-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WE_MP_RSS_BASE_URL = "http://localhost:8001";
    process.env.WE_MP_RSS_ACCESS_KEY = "ak";
    process.env.WE_MP_RSS_SECRET_KEY = "sk";
  });

  it("应触发同步并采集文章", async () => {
    const source = {
      id: "s1",
      name: "人民日报",
      feedId: "mp1",
      provider: "we-mp-rss",
      isEnabled: true,
      trustLevel: "verified",
      contentType: "policy_analysis",
      lastCollectedAt: null,
    };
    mockDb.source.findUnique.mockResolvedValueOnce(source);
    mockTriggerFeedSync.mockResolvedValueOnce({ taskId: "t1", status: "pending" });
    mockListArticles.mockResolvedValueOnce({
      list: [{ id: "a1", title: "文章1", mpId: "mp1" }],
      total: 1,
    });
    mockFromWeMpRssArticle.mockReturnValueOnce({ id: "a1", title: "文章1" });
    mockNormalizeWeRssArticles.mockResolvedValueOnce({
      discovered: 1, imported: 1, skipped: 0, blocked: 0, refreshed: 0, errors: [],
    });
    mockDb.source.update.mockResolvedValueOnce({});

    const { POST } = await import("../refresh-source/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/refresh-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: "s1" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(1);
    expect(mockTriggerFeedSync).toHaveBeenCalled();
  });

  it("60 秒内重复刷新应返回 429（Q9）", async () => {
    const source = {
      id: "s1",
      name: "人民日报",
      feedId: "mp1",
      provider: "we-mp-rss",
      isEnabled: true,
      trustLevel: "verified",
      contentType: "policy_analysis",
      lastCollectedAt: new Date(), // 刚刚采集过
    };
    mockDb.source.findUnique.mockResolvedValueOnce(source);

    const { POST } = await import("../refresh-source/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/refresh-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: "s1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("缺少 sourceId 应返回 400", async () => {
    const { POST } = await import("../refresh-source/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/refresh-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("非 we-mp-rss 来源应返回 400", async () => {
    mockDb.source.findUnique.mockResolvedValueOnce({
      id: "s1", provider: "manual", feedId: null, isEnabled: true,
    });

    const { POST } = await import("../refresh-source/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/refresh-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: "s1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── Delete-missing-sources route ──────────────────────────────────────

describe("POST /api/integrations/wechat-rss/delete-missing-sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应软删除 we-mp-rss 来源", async () => {
    mockDb.source.findMany.mockResolvedValueOnce([
      { id: "s1", name: "已删除", feedId: "mp1" },
    ]);
    mockDb.source.updateMany.mockResolvedValueOnce({ count: 1 });

    const { POST } = await import("../delete-missing-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/delete-missing-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: ["s1"] }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.deleted).toBe(1);
  });

  it("只允许删除 provider=we-mp-rss 的来源", async () => {
    mockDb.source.findMany.mockResolvedValueOnce([]); // 没有匹配的 we-mp-rss 来源

    const { POST } = await import("../delete-missing-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/delete-missing-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: ["s-manual"] }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.deleted).toBe(0);
  });

  it("缺少 sourceIds 应返回 400", async () => {
    const { POST } = await import("../delete-missing-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/delete-missing-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("deleteContentItems=true 应同时删除关联内容", async () => {
    mockDb.source.findMany.mockResolvedValueOnce([
      { id: "s1", name: "测试", feedId: "mp1" },
    ]);
    mockDb.contentItem = { deleteMany: vi.fn().mockResolvedValueOnce({ count: 5 }) };
    mockDb.source.updateMany.mockResolvedValueOnce({ count: 1 });

    const { POST } = await import("../delete-missing-sources/route");
    const req = new NextRequest("http://localhost/api/integrations/wechat-rss/delete-missing-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: ["s1"], deleteContentItems: true }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.contentItemsDeleted).toBe(5);
  });
});
