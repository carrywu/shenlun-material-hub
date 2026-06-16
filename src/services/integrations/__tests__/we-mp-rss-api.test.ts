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
    it("应正确请求 /api/mps 并传参", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ list: [{ id: "mp1", mpName: "测试" }], total: 1, page: 1 })
      );
      const result = await listFeeds(BASE, AK, SK, { limit: 10, offset: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/mps?limit=10&offset=0",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "AK-SK test-ak:test-sk",
          }),
        })
      );
      expect(result.total).toBe(1);
      expect(result.list[0].mpName).toBe("测试");
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
  });

  // ── getFeedDetail ─────────────────────────────────────────────────────────

  describe("getFeedDetail", () => {
    it("应请求 /api/mps/{mpId}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ id: "mp1", mpName: "测试公众号" })
      );
      const result = await getFeedDetail(BASE, AK, SK, "mp1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/mps/mp1",
        expect.anything()
      );
      expect(result.id).toBe("mp1");
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
        "http://localhost:8001/api/mps/update/mp1",
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
        expect.stringContaining("/api/mps/search/"),
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
        "http://localhost:8001/api/mps",
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
        "http://localhost:8001/api/mps/mp1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.message).toBe("deleted");
    });
  });

  // ── listArticles ─────────────────────────────────────────────────────────

  describe("listArticles", () => {
    it("应请求 /api/articles 并传 mp_id", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [{ id: "art1", title: "文章", hasContent: 1, fixFailCount: 0 }],
          total: 1,
          page: 1,
        })
      );
      const result = await listArticles(BASE, AK, SK, { mpId: "mp1" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/articles?mp_id=mp1"),
        expect.anything()
      );
      expect(result.total).toBe(1);
      expect(result.list[0].id).toBe("art1");
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
  });

  // ── getArticle ───────────────────────────────────────────────────────────

  describe("getArticle", () => {
    it("应请求 /api/articles/{articleId}", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({ id: "art1", title: "文章" })
      );
      const result = await getArticle(BASE, AK, SK, "art1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/articles/art1",
        expect.anything()
      );
      expect(result.id).toBe("art1");
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
        "http://localhost:8001/api/articles/art1/refresh",
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
        "http://localhost:8001/api/articles/refresh/tasks/task-1",
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
        "http://localhost:8001/api/mps/featured/article",
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
        "http://localhost:8001/api/mps/featured/article/tasks/task-1",
        expect.anything()
      );
      expect(result.status).toBe("SUCCESS");
    });
  });

  // ── getContentHealth ─────────────────────────────────────────────────────

  describe("getContentHealth", () => {
    it("应统计最近文章的 hasContent 缺失比例", async () => {
      mockFetch.mockResolvedValueOnce(
        mockApiSuccess({
          list: [
            { id: "a1", hasContent: 1, fixFailCount: 0 },
            { id: "a2", hasContent: 0, fixFailCount: 0 },
            { id: "a3", hasContent: 1, fixFailCount: 0 },
            { id: "a4", hasContent: 0, fixFailCount: 0 },
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
        "http://localhost:8001/api/mps",
        expect.anything()
      );
    });
  });
});
