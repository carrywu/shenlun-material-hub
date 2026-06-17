import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock global fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockApiSuccess(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve({ code: 0, message: "success", data }),
  };
}

function mockApiError(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ code: status, message: statusText }),
  };
}

// Import after mock setup
import {
  checkHealth,
  listFeeds,
  getFeedDetail,
  triggerFeedSync,
  searchFeeds,
  addFeed,
  deleteFeed,
  listArticles,
  getArticle,
  refreshArticle,
  getRefreshTaskStatus,
  importArticle,
  getImportTaskStatus,
  getContentHealth,
  WeMpRssApiError,
  WeMpRssAuthError,
  FEATURED_MP_ID,
  SYNC_ARTICLE_LIMIT,
  IMPORT_POLL_TIMEOUT,
  IMPORT_POLL_INTERVAL,
  REFRESH_DEBOUNCE_MS,
  REFRESH_RATE_LIMIT_S,
  AUTH_EXPIRED_RATIO,
} from "../we-mp-rss-api";

const BASE = "http://localhost:8001";
const AK = "test-ak";
const SK = "test-sk";

describe("we-mp-rss-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 常量 ────────────────────────────────────────────────────────────────

  describe("导出常量", () => {
    it("应导出正确的常量值", () => {
      expect(FEATURED_MP_ID).toBe("MP_WXS_FEATURED_ARTICLES");
      expect(SYNC_ARTICLE_LIMIT).toBe(100);
      expect(IMPORT_POLL_TIMEOUT).toBe(120_000);
      expect(IMPORT_POLL_INTERVAL).toBe(3_000);
      expect(REFRESH_DEBOUNCE_MS).toBe(30_000);
      expect(REFRESH_RATE_LIMIT_S).toBe(60);
      expect(AUTH_EXPIRED_RATIO).toBe(0.5);
    });
  });

  // ── 错误类 ──────────────────────────────────────────────────────────────

  describe("WeMpRssApiError", () => {
    it("应包含 code 属性", () => {
      const err = new WeMpRssApiError("test error", 500);
      expect(err.name).toBe("WeMpRssApiError");
      expect(err.message).toBe("test error");
      expect(err.code).toBe(500);
    });
  });

  describe("WeMpRssAuthError", () => {
    it("应正确构造", () => {
      const err = new WeMpRssAuthError("auth failed");
      expect(err.name).toBe("WeMpRssAuthError");
      expect(err.message).toBe("auth failed");
    });
  });

  // ── checkHealth ──────────────────────────────────────────────────────────

  describe("checkHealth", () => {
    it("应返回 valid 当 API 可达", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 5 })
      );
      const result = await checkHealth(BASE, AK, SK);
      expect(result.reachable).toBe(true);
      expect(result.feedCount).toBe(5);
      expect(result.authStatus).toBe("valid");
    });

    it("应返回 expired 当认证失败 (401/403)", async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(401, "Unauthorized"));
      const result = await checkHealth(BASE, AK, SK);
      expect(result.reachable).toBe(true);
      expect(result.authStatus).toBe("expired");
    });

    it("应返回 unknown 当服务不可达", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const result = await checkHealth(BASE, AK, SK);
      expect(result.reachable).toBe(false);
      expect(result.authStatus).toBe("unknown");
    });
  });

  // ── listFeeds ────────────────────────────────────────────────────────────

  describe("listFeeds", () => {
    it("应正确请求 /api/mps 并传参，snake_case 响应映射为 camelCase", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{ id: "mp1", mp_name: "测试", mp_intro: "简介", mp_cover: "https://example.com/cover.jpg", status: 1, sync_time: 1700000000, update_time: 1700001000, created_at: "2026-06-15T10:00:00Z" }],
          total: 1,
          page: 1,
        })
      );
      const result = await listFeeds(BASE, AK, SK, { limit: 10, offset: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps?limit=10&offset=0",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "AK-SK test-ak:test-sk",
          }),
        })
      );
      expect(result.total).toBe(1);
      // snake_case → camelCase 映射验证
      expect(result.list[0].mpName).toBe("测试");
      expect(result.list[0].mpIntro).toBe("简介");
      expect(result.list[0].mpCover).toBe("https://example.com/cover.jpg");
      expect(result.list[0].status).toBe(1);
      expect(result.list[0].syncTime).toBe(1700000000);
      expect(result.list[0].updateTime).toBe(1700001000);
      expect(result.list[0].createdAt).toBeTypeOf("number");
    });

    it("应支持搜索关键词 kw", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 0, page: 1 })
      );
      await listFeeds(BASE, AK, SK, { kw: "人民" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("kw=%E4%BA%BA%E6%B0%91"),
        expect.anything()
      );
    });

    it("null snake_case 字段应映射为 undefined", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{ id: "mp1", mp_name: "测试", mp_intro: null, mp_cover: null, status: 1, sync_time: null, update_time: null, created_at: "2026-06-15T10:00:00Z" }],
          total: 1,
          page: 1,
        })
      );
      const result = await listFeeds(BASE, AK, SK, {});
      expect(result.list[0].mpIntro).toBeUndefined();
      expect(result.list[0].mpCover).toBeUndefined();
      expect(result.list[0].syncTime).toBeUndefined();
      expect(result.list[0].updateTime).toBeUndefined();
    });
  });

  // ── getFeedDetail ─────────────────────────────────────────────────────────

  describe("getFeedDetail", () => {
    it("应请求 /api/mps/{mpId}，snake_case 响应映射为 camelCase", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ id: "mp1", mp_name: "测试公众号", mp_intro: "简介", mp_cover: null, status: 1, sync_time: 1700000000, update_time: null, created_at: "2026-06-15T10:00:00Z" })
      );
      const result = await getFeedDetail(BASE, AK, SK, "mp1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps/mp1",
        expect.anything()
      );
      expect(result.id).toBe("mp1");
      expect(result.mpName).toBe("测试公众号");
      expect(result.mpIntro).toBe("简介");
      expect(result.mpCover).toBeUndefined();
      expect(result.syncTime).toBe(1700000000);
      expect(result.createdAt).toBeTypeOf("number");
    });
  });

  // ── triggerFeedSync ──────────────────────────────────────────────────────

  describe("triggerFeedSync", () => {
    it("应用 GET 请求触发同步（不是 POST）", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-1", message: "syncing" })
      );
      const result = await triggerFeedSync(BASE, AK, SK, "mp1");
      const callArgs = mockFetch.mock.calls[0][1] as Record<string, unknown>;
      // GET 请求：不传 method 或 method 不是 POST
      expect(callArgs.method === undefined || callArgs.method === "GET").toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps/update/mp1",
        expect.anything()
      );
      expect(result.taskId).toBe("task-1");
      expect(result.status).toBe("pending");
    });

    it("应支持分页参数 startPage/endPage", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-2", message: "ok" })
      );
      await triggerFeedSync(BASE, AK, SK, "mp1", { startPage: 1, endPage: 5 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("start_page=1"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("end_page=5"),
        expect.anything()
      );
    });
  });

  // ── searchFeeds ──────────────────────────────────────────────────────────

  describe("searchFeeds", () => {
    it("应请求 /api/mps/search/{kw}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [{ id: "mp1" }], total: 1 })
      );
      const result = await searchFeeds(BASE, AK, SK, "人民");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/wx/mps/search/"),
        expect.anything()
      );
      expect(result.total).toBe(1);
    });
  });

  // ── addFeed ──────────────────────────────────────────────────────────────

  describe("addFeed", () => {
    it("应用 POST 请求 /api/mps", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-add", message: "adding" })
      );
      const result = await addFeed(BASE, AK, SK, "https://mp.weixin.qq.com/xxx");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.taskId).toBe("task-add");
      expect(result.status).toBe("pending");
    });
  });

  // ── deleteFeed ───────────────────────────────────────────────────────────

  describe("deleteFeed", () => {
    it("应用 DELETE 请求 /api/mps/{mpId}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ message: "deleted" })
      );
      const result = await deleteFeed(BASE, AK, SK, "mp1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps/mp1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.message).toBe("deleted");
    });
  });

  // ── listArticles ─────────────────────────────────────────────────────────

  describe("listArticles", () => {
    it("应请求 /api/articles 并传 mp_id，snake_case 响应映射为 camelCase", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{
            id: "art1",
            mp_id: "mp1",
            title: "文章",
            url: "https://mp.weixin.qq.com/s/1",
            has_content: 1,
            fix_fail_count: 0,
            pic_url: "https://example.com/pic.jpg",
            description: null,
            content: null,
            content_html: null,
            publish_time: 1700000000,
            create_time: 1700001000,
          }],
          total: 1,
          page: 1,
        })
      );
      const result = await listArticles(BASE, AK, SK, { mpId: "mp1" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/wx/articles?mp_id=mp1"),
        expect.anything()
      );
      expect(result.total).toBe(1);
      // snake_case → camelCase 映射验证
      expect(result.list[0].id).toBe("art1");
      expect(result.list[0].mpId).toBe("mp1");
      expect(result.list[0].title).toBe("文章");
      expect(result.list[0].url).toBe("https://mp.weixin.qq.com/s/1");
      expect(result.list[0].hasContent).toBe(1);
      expect(result.list[0].fixFailCount).toBe(0);
      expect(result.list[0].picUrl).toBe("https://example.com/pic.jpg");
      expect(result.list[0].description).toBeUndefined();
      expect(result.list[0].content).toBeUndefined();
      expect(result.list[0].contentHtml).toBeUndefined();
      expect(result.list[0].publishTime).toBe(1700000000);
      expect(result.list[0].createdAt).toBe(1700001000);
    });

    it("应支持 has_content 过滤", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 0, page: 1 })
      );
      await listArticles(BASE, AK, SK, { mpId: "mp1", hasContent: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("has_content=0"),
        expect.anything()
      );
    });

    it("null snake_case 字段应映射为 undefined", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{
            id: "art1",
            mp_id: "mp1",
            title: "文章",
            url: "https://mp.weixin.qq.com/s/1",
            has_content: 1,
            fix_fail_count: 0,
            pic_url: null,
            description: null,
            content: null,
            content_html: null,
            publish_time: null,
            create_time: null,
          }],
          total: 1,
          page: 1,
        })
      );
      const result = await listArticles(BASE, AK, SK, { mpId: "mp1" });
      expect(result.list[0].picUrl).toBeUndefined();
      expect(result.list[0].description).toBeUndefined();
      expect(result.list[0].content).toBeUndefined();
      expect(result.list[0].contentHtml).toBeUndefined();
      expect(result.list[0].publishTime).toBeUndefined();
      expect(result.list[0].createdAt).toBeUndefined();
    });

    it("created_at ISO string 应映射为 Unix timestamp 秒", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{
            id: "art1",
            mp_id: "mp1",
            title: "文章",
            url: "https://mp.weixin.qq.com/s/1",
            has_content: 1,
            fix_fail_count: 0,
            publish_time: 1700000000,
            created_at: "2026-06-15T10:00:00.000Z",
          }],
          total: 1,
          page: 1,
        })
      );
      const result = await listArticles(BASE, AK, SK, { mpId: "mp1" });
      expect(result.list[0].createdAt).toBeTypeOf("number");
      // 2026-06-15T10:00:00.000Z → ~1771214400
      expect(result.list[0].createdAt).toBeGreaterThan(1_700_000_000);
    });
  });

  // ── getArticle ───────────────────────────────────────────────────────────

  describe("getArticle", () => {
    it("应请求 /api/articles/{articleId}，snake_case 响应映射为 camelCase", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          id: "art1",
          mp_id: "mp1",
          title: "文章详情",
          url: "https://mp.weixin.qq.com/s/1",
          has_content: 1,
          fix_fail_count: 0,
          pic_url: null,
          description: "摘要",
          content: "<p>正文</p>",
          content_html: "<html>原始HTML</html>",
          publish_time: 1700000000,
          create_time: 1700001000,
        })
      );
      const result = await getArticle(BASE, AK, SK, "art1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/articles/art1",
        expect.anything()
      );
      expect(result.id).toBe("art1");
      expect(result.mpId).toBe("mp1");
      expect(result.title).toBe("文章详情");
      expect(result.hasContent).toBe(1);
      expect(result.contentHtml).toBe("<html>原始HTML</html>");
      expect(result.content).toBe("<p>正文</p>");
      expect(result.fixFailCount).toBe(0);
      expect(result.publishTime).toBe(1700000000);
      expect(result.picUrl).toBeUndefined();
    });
  });

  // ── refreshArticle ──────────────────────────────────────────────────────

  describe("refreshArticle", () => {
    it("应用 POST 请求 /api/articles/{id}/refresh", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-refresh", message: "refreshing" })
      );
      const result = await refreshArticle(BASE, AK, SK, "art1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/articles/art1/refresh",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.taskId).toBe("task-refresh");
      expect(result.status).toBe("pending");
    });
  });

  // ── getRefreshTaskStatus ─────────────────────────────────────────────────

  describe("getRefreshTaskStatus", () => {
    it("应请求 /api/articles/refresh/tasks/{taskId}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-1", status: "SUCCESS", message: "done" })
      );
      const result = await getRefreshTaskStatus(BASE, AK, SK, "task-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/articles/refresh/tasks/task-1",
        expect.anything()
      );
      expect(result.status).toBe("SUCCESS");
    });
  });

  // ── importArticle ────────────────────────────────────────────────────────

  describe("importArticle", () => {
    it("应用 POST 请求 /api/mps/featured/article", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-import", message: "importing" })
      );
      const result = await importArticle(BASE, AK, SK, "https://mp.weixin.qq.com/s/test");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps/featured/article",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.taskId).toBe("task-import");
      expect(result.status).toBe("pending");
    });
  });

  // ── getImportTaskStatus ──────────────────────────────────────────────────

  describe("getImportTaskStatus", () => {
    it("应请求 /api/mps/featured/article/tasks/{taskId}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ task_id: "task-1", status: "SUCCESS", message: "ok" })
      );
      const result = await getImportTaskStatus(BASE, AK, SK, "task-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps/featured/article/tasks/task-1",
        expect.anything()
      );
      expect(result.status).toBe("SUCCESS");
    });
  });

  // ── getContentHealth ─────────────────────────────────────────────────────

  describe("getContentHealth", () => {
    it("应统计最近文章的 hasContent 缺失比例（snake_case API 响应已映射）", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [
            { id: "a1", mp_id: "mp1", title: "t1", url: "u1", has_content: 1, fix_fail_count: 0, publish_time: 1700000000 },
            { id: "a2", mp_id: "mp1", title: "t2", url: "u2", has_content: 0, fix_fail_count: 0, publish_time: 1700000000 },
            { id: "a3", mp_id: "mp1", title: "t3", url: "u3", has_content: 1, fix_fail_count: 0, publish_time: 1700000000 },
            { id: "a4", mp_id: "mp1", title: "t4", url: "u4", has_content: 0, fix_fail_count: 0, publish_time: 1700000000 },
          ],
          total: 4,
          page: 1,
        })
      );
      const result = await getContentHealth(BASE, AK, SK, "mp1");
      expect(result.totalArticles).toBe(4);
      expect(result.missingContent).toBe(2);
      expect(result.ratio).toBe(0.5);
    });

    it("应返回 ratio=0 当列表为空", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 0, page: 1 })
      );
      const result = await getContentHealth(BASE, AK, SK, "mp1");
      expect(result.totalArticles).toBe(0);
      expect(result.missingContent).toBe(0);
      expect(result.ratio).toBe(0);
    });

    it("API 错误时应返回默认值", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const result = await getContentHealth(BASE, AK, SK, "mp1");
      expect(result).toEqual({ totalArticles: 0, missingContent: 0, ratio: 0 });
    });
  });

  // ── 认证头格式 ──────────────────────────────────────────────────────────

  describe("AK-SK 认证", () => {
    it("应在所有请求中设置 Authorization 头", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 0 })
      );
      await listFeeds(BASE, AK, SK, {});
      const callArgs = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
      expect(callArgs.headers.Authorization).toBe("AK-SK test-ak:test-sk");
    });
  });

  // ── 错误处理 ────────────────────────────────────────────────────────────

  describe("错误处理", () => {
    it("HTTP 401 应抛出 WeMpRssAuthError", async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(401, "Unauthorized"));
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssAuthError);
    });

    it("HTTP 403 应抛出 WeMpRssAuthError", async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(403, "Forbidden"));
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssAuthError);
    });

    it("HTTP 500 应抛出 WeMpRssApiError", async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(500, "Internal Error"));
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssApiError);
    });

    it("API 返回 code≠0 应抛出 WeMpRssApiError", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: -1, message: "参数错误", data: null }),
      });
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssApiError);
    });

    it("ECONNREFUSED 应抛出 WeMpRssApiError", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssApiError);
    });

    it("abort 应抛出 WeMpRssApiError（超时）", async () => {
      mockFetch.mockRejectedValueOnce(new Error("The operation was abort"));
      await expect(listFeeds(BASE, AK, SK, {})).rejects.toThrow(WeMpRssApiError);
    });
  });

  // ── baseUrl 规范化 ──────────────────────────────────────────────────────

  describe("baseUrl 尾部斜杠处理", () => {
    it("应去除尾部斜杠", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [], total: 0 })
      );
      await listFeeds("http://localhost:8001/", AK, SK, {});
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/wx/mps",
        expect.anything()
      );
    });
  });
});
