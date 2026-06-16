import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 用 vi.hoisted() 提前创建所有 mock ────────────────────────────────────

const {
  mockListFeedsApi,
  mockListArticlesApi,
  mockCheckSqliteDb,
  mockListFeedsFromSqlite,
  mockListArticlesFromSqlite,
} = vi.hoisted(() => ({
  mockListFeedsApi: vi.fn(),
  mockListArticlesApi: vi.fn(),
  mockCheckSqliteDb: vi.fn(),
  mockListFeedsFromSqlite: vi.fn(),
  mockListArticlesFromSqlite: vi.fn(),
}));

// wechat-rss.ts re-exports ALL symbols from we-mp-rss-api and we-mp-rss-sqlite
// The mock factory must provide every re-exported value, otherwise module resolution fails.

vi.mock("../we-mp-rss-api", () => ({
  // 常量
  FEATURED_MP_ID: "MP_WXS_FEATURED_ARTICLES",
  SYNC_ARTICLE_LIMIT: 100,
  IMPORT_POLL_TIMEOUT: 120_000,
  IMPORT_POLL_INTERVAL: 3_000,
  REFRESH_DEBOUNCE_MS: 30_000,
  REFRESH_RATE_LIMIT_S: 60,
  AUTH_EXPIRED_RATIO: 0.5,
  // 错误类
  WeMpRssApiError: class WeMpRssApiError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.name = "WeMpRssApiError";
      this.code = code;
    }
  },
  WeMpRssAuthError: class WeMpRssAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WeMpRssAuthError";
    }
  },
  // API 函数
  checkHealth: vi.fn().mockResolvedValue({ reachable: true, authStatus: "valid" }),
  listFeeds: mockListFeedsApi,
  getFeedDetail: vi.fn(),
  triggerFeedSync: vi.fn(),
  searchFeeds: vi.fn(),
  addFeed: vi.fn(),
  deleteFeed: vi.fn(),
  listArticles: mockListArticlesApi,
  getArticle: vi.fn(),
  refreshArticle: vi.fn(),
  getRefreshTaskStatus: vi.fn(),
  importArticle: vi.fn(),
  getImportTaskStatus: vi.fn(),
  getContentHealth: vi.fn(),
}));

vi.mock("../we-mp-rss-sqlite", () => ({
  checkSqliteDb: mockCheckSqliteDb,
  listFeedsFromSqlite: mockListFeedsFromSqlite,
  listArticlesFromSqlite: mockListArticlesFromSqlite,
  listAllArticlesFromSqlite: vi.fn(),
}));

import { listFeedsAuto, listArticlesAuto } from "../wechat-rss";
import type { SyncMode } from "../wechat-rss";

const BASE = "http://localhost:8001";
const AK = "test-ak";
const SK = "test-sk";

describe("wechat-rss facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listFeedsAuto ──────────────────────────────────────────────────────

  describe("listFeedsAuto", () => {
    it("syncMode=api 应直接调 API", async () => {
      mockListFeedsApi.mockResolvedValueOnce({
        list: [{ id: "mp1", mpName: "人民日报" }],
        total: 1,
        page: 1,
      });
      const result = await listFeedsAuto(BASE, AK, SK, "api");
      expect(result.source).toBe("api");
      expect(result.feeds).toHaveLength(1);
      expect(mockListFeedsFromSqlite).not.toHaveBeenCalled();
    });

    it("syncMode=sqlite 应直接调 SQLite", async () => {
      mockListFeedsFromSqlite.mockResolvedValueOnce([
        { id: "mp2", mpName: "新华社" },
      ]);
      const result = await listFeedsAuto(BASE, AK, SK, "sqlite", "/tmp/test.db");
      expect(result.source).toBe("sqlite");
      expect(result.feeds).toHaveLength(1);
      expect(mockListFeedsApi).not.toHaveBeenCalled();
    });

    it("syncMode=auto 应 API 优先，失败后 SQLite 兜底", async () => {
      mockListFeedsApi.mockRejectedValueOnce(new Error("API down"));
      mockCheckSqliteDb.mockResolvedValueOnce({ exists: true, readable: true });
      mockListFeedsFromSqlite.mockResolvedValueOnce([
        { id: "mp3", mpName: "央视新闻" },
      ]);
      const result = await listFeedsAuto(BASE, AK, SK, "auto", "/tmp/test.db");
      expect(result.source).toBe("sqlite");
      expect(result.message).toContain("API 不可用");
    });

    it("syncMode=auto API 可达时应返回 API 结果", async () => {
      mockListFeedsApi.mockResolvedValueOnce({
        list: [{ id: "mp1", mpName: "人民日报" }],
        total: 1,
        page: 1,
      });
      const result = await listFeedsAuto(BASE, AK, SK, "auto");
      expect(result.source).toBe("api");
      expect(result.feeds).toHaveLength(1);
    });

    it("syncMode=auto API 失败且 SQLite 不可读时应抛错", async () => {
      mockListFeedsApi.mockRejectedValueOnce(new Error("API down"));
      mockCheckSqliteDb.mockResolvedValueOnce({ exists: true, readable: false });
      await expect(
        listFeedsAuto(BASE, AK, SK, "auto", "/tmp/test.db")
      ).rejects.toThrow("API down");
    });

    it("syncMode=manual 应返回空列表", async () => {
      const result = await listFeedsAuto(BASE, AK, SK, "manual");
      expect(result.feeds).toHaveLength(0);
      expect(result.message).toContain("手动模式");
    });
  });

  // ── listArticlesAuto ───────────────────────────────────────────────────

  describe("listArticlesAuto", () => {
    const params = { mpId: "mp1", offset: 0, limit: 10 };

    it("syncMode=api 应直接调 API", async () => {
      mockListArticlesApi.mockResolvedValueOnce({
        list: [{ id: "art1", title: "文章1" }],
        total: 1,
        page: 1,
      });
      const result = await listArticlesAuto(BASE, AK, SK, "api", undefined, params);
      expect(result.source).toBe("api");
      expect(result.total).toBe(1);
      expect(mockListArticlesFromSqlite).not.toHaveBeenCalled();
    });

    it("syncMode=sqlite 应直接调 SQLite", async () => {
      mockListArticlesFromSqlite.mockResolvedValueOnce({
        list: [{ id: "art2", title: "文章2" }],
        total: 1,
      });
      const result = await listArticlesAuto(BASE, AK, SK, "sqlite", "/tmp/test.db", params);
      expect(result.source).toBe("sqlite");
      expect(result.total).toBe(1);
      expect(mockListArticlesApi).not.toHaveBeenCalled();
    });

    it("syncMode=auto API 失败应降级到 SQLite", async () => {
      mockListArticlesApi.mockRejectedValueOnce(new Error("API down"));
      mockCheckSqliteDb.mockResolvedValueOnce({ exists: true, readable: true });
      mockListArticlesFromSqlite.mockResolvedValueOnce({
        list: [{ id: "art3", title: "兜底文章" }],
        total: 1,
      });
      const result = await listArticlesAuto(BASE, AK, SK, "auto", "/tmp/test.db", params);
      expect(result.source).toBe("sqlite");
      expect(result.message).toContain("API 不可用");
    });

    it("syncMode=manual 应返回空列表", async () => {
      const result = await listArticlesAuto(BASE, AK, SK, "manual", undefined, params);
      expect(result.articles).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── SyncMode type ──────────────────────────────────────────────────────

  describe("SyncMode 类型", () => {
    it("应支持四种模式", () => {
      const modes: SyncMode[] = ["auto", "api", "sqlite", "manual"];
      expect(modes).toHaveLength(4);
    });
  });
});
