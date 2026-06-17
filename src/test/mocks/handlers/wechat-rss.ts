import { http, HttpResponse } from "msw";
import { getAuthUser } from "./auth";

/**
 * we-mp-rss integration mock handlers.
 * Covers: /api/integrations/wechat-rss/*, /api/collectors/wechat/*,
 *         /api/settings/integrations/wechat-rss/*
 */

// ─── Shared fixtures ───

const MOCK_WECHAT_SOURCE = {
  id: "mp-source-1",
  name: "观潮的螃蟹",
  cover: "https://example.com/cover1.jpg",
  intro: "时政评论公众号",
  status: "active",
};

const MOCK_WECHAT_SOURCE_2 = {
  id: "mp-source-2",
  name: "浙江宣传",
  cover: "https://example.com/cover2.jpg",
  intro: "浙江省委宣传部公众号",
  status: "active",
};

const MOCK_WECHAT_ARTICLE = {
  id: "mp-article-1",
  title: "基层治理的浙江解法",
  link: "https://mp.weixin.qq.com/s/mock-article-1",
  pub_date: "2026-06-15T08:00:00Z",
  mp_id: "mp-source-2",
  has_content: 1,
  content: "浙江探索基层治理新路径...",
  content_html: "<p>浙江探索基层治理新路径...</p>",
};

const WECHAT_SOURCES = [MOCK_WECHAT_SOURCE, MOCK_WECHAT_SOURCE_2];
const WECHAT_ARTICLES = [MOCK_WECHAT_ARTICLE];

// ─── Handlers ───

export const wechatRssHandlers = [
  // GET /api/integrations/wechat-rss/status
  http.get("/api/integrations/wechat-rss/status", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      baseUrl: "http://localhost:8001",
      reachable: true,
      feedCount: 2,
      message: "连接正常",
      authStatus: "aksk",
      akskConfigured: true,
      contentHealth: { total: 10, hasContent: 8, blocked: 2 },
      channels: { api: true, sqlite: false },
    });
  }),

  // POST /api/integrations/wechat-rss/test
  http.post("/api/integrations/wechat-rss/test", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, string>;
    if (!body.baseUrl) {
      return HttpResponse.json(
        { success: false, message: "缺少 baseUrl" },
        { status: 400 }
      );
    }
    return HttpResponse.json({
      success: true,
      message: "连接测试成功",
      feedCount: 2,
      authStatus: body.accessKey ? "aksk" : "none",
    });
  }),

  // POST /api/integrations/wechat-rss/sync-sources
  http.post("/api/integrations/wechat-rss/sync-sources", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      message: "同步完成",
      syncSource: "we-mp-rss",
      created: 0,
      updated: 2,
      skipped: 0,
      toDelete: 0,
      total: 2,
    });
  }),

  // POST /api/integrations/wechat-rss/preview-sync
  http.post("/api/integrations/wechat-rss/preview-sync", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      source: "we-mp-rss",
      message: "预览同步结果",
      toCreate: 0,
      toUpdate: 2,
      toDelete: 0,
      manualSourcesIgnored: 1,
      total: 2,
    });
  }),

  // POST /api/integrations/wechat-rss/refresh-source
  http.post("/api/integrations/wechat-rss/refresh-source", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json({
      success: true,
      discoveredCount: 3,
      importedCount: 2,
      skippedCount: 1,
      blockedCount: 0,
    });
  }),

  // POST /api/integrations/wechat-rss/delete-missing-sources
  http.post("/api/integrations/wechat-rss/delete-missing-sources", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: "已删除指定来源",
      deleted: (body.sourceIds as string[]).length,
      contentItemsDeleted: 0,
      deletedSources: body.sourceIds,
    });
  }),

  // GET /api/collectors/wechat/sources
  http.get("/api/collectors/wechat/sources", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ sources: WECHAT_SOURCES });
  }),

  // GET /api/collectors/wechat/articles
  http.get("/api/collectors/wechat/articles", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const mpId = url.searchParams.get("mpId") || url.searchParams.get("sourceId") || "";
    const filtered = mpId
      ? WECHAT_ARTICLES.filter((a) => a.mp_id === mpId)
      : WECHAT_ARTICLES;
    return HttpResponse.json({
      articles: filtered,
      total: filtered.length,
    });
  }),

  // POST /api/collectors/wechat/sync
  http.post("/api/collectors/wechat/sync", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json(
      {
        success: true,
        accepted: true,
        taskId: "mock-wechat-sync-task-id",
        status: "PENDING",
        sourceName: "浙江宣传",
        message: "同步任务已提交",
      },
      { status: 202 }
    );
  }),

  // POST /api/collectors/wechat/sync/preview
  http.post("/api/collectors/wechat/sync/preview", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      total: WECHAT_ARTICLES.length,
      articles: WECHAT_ARTICLES.map((a) => ({
        title: a.title,
        link: a.link,
        pubDate: a.pub_date,
      })),
    });
  }),

  // POST /api/collectors/wechat/sync/confirm
  http.post("/api/collectors/wechat/sync/confirm", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      discoveredCount: 3,
      importedCount: 2,
      skippedCount: 1,
      blockedCount: 0,
    });
  }),

  // POST /api/collectors/wechat/import
  http.post("/api/collectors/wechat/import", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      discoveredCount: (body.urls as string[]).length,
      importedCount: (body.urls as string[]).length,
      skippedCount: 0,
      blockedCount: 0,
    });
  }),

  // GET/POST /api/settings/integrations/wechat-rss
  http.get("/api/settings/integrations/wechat-rss", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      configured: true,
      id: "mock-integration-id",
      isEnabled: true,
      baseUrl: "http://localhost:8001",
      accessKey: "mock-access-key",
      secretKeyConfigured: true,
      dbPath: "",
      syncMode: "api",
      updatedAt: "2026-06-15T10:00:00Z",
    });
  }),

  http.post("/api/settings/integrations/wechat-rss", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      configured: true,
      id: "mock-integration-id",
      isEnabled: true,
      baseUrl: "http://localhost:8001",
      accessKey: "mock-access-key",
      secretKeyConfigured: true,
      dbPath: "",
      syncMode: "api",
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete("/api/settings/integrations/wechat-rss", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true });
  }),

  http.put("/api/settings/integrations/wechat-rss", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, isEnabled: body.isEnabled });
  }),

  http.post("/api/settings/integrations/wechat-rss/test", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      message: "连接测试成功",
      feedCount: 2,
      authStatus: "aksk",
    });
  }),
];
