/**
 * 微信 RSS 集成 facade
 * 作为 sidecar 调用本地 we-mp-rss 服务，不合并其源码。
 * 外部接口通用命名（Q16），内部委托给 we-mp-rss-api / we-mp-rss-sqlite。
 *
 * SyncMode：
 *   - auto:   API 优先 → SQLite 只读兜底
 *   - api:    仅 API
 *   - sqlite: 仅 SQLite
 *   - manual: 不自动同步
 */

export type SyncMode = "auto" | "api" | "sqlite" | "manual";

// 重导出内部模块的公共接口
export {
  FEATURED_MP_ID,
  SYNC_ARTICLE_LIMIT,
  IMPORT_POLL_TIMEOUT,
  IMPORT_POLL_INTERVAL,
  REFRESH_DEBOUNCE_MS,
  REFRESH_RATE_LIMIT_S,
  AUTH_EXPIRED_RATIO,
  WeMpRssApiError,
  WeMpRssAuthError,
} from "./we-mp-rss-api";

export type {
  WeMpRssFeed,
  WeMpRssArticle,
  WeMpRssTaskResult,
  WeMpRssListFeedsParams,
  WeMpRssListArticlesParams,
  HealthCheckResult,
  ContentHealth,
} from "./we-mp-rss-api";

export type { SqliteCheckResult } from "./we-mp-rss-sqlite";

export {
  checkSqliteDb,
  listFeedsFromSqlite,
  listArticlesFromSqlite,
  listAllArticlesFromSqlite,
} from "./we-mp-rss-sqlite";

export {
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
} from "./we-mp-rss-api";

// ── Facade 函数 ──────────────────────────────────────────────────────────

import {
  listFeeds as listFeedsApi,
  listArticles as listArticlesApi,
} from "./we-mp-rss-api";
import type {
  WeMpRssFeed,
  WeMpRssArticle,
  WeMpRssListFeedsParams,
  WeMpRssListArticlesParams,
} from "./we-mp-rss-api";
import {
  listFeedsFromSqlite,
  listArticlesFromSqlite,
  checkSqliteDb,
} from "./we-mp-rss-sqlite";

/**
 * 自动检测并获取订阅列表。
 * 优先 API，SQLite 只读兜底。
 */
export async function listFeedsAuto(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  syncMode: SyncMode = "auto",
  dbPath?: string
): Promise<{
  feeds: WeMpRssFeed[];
  source: "api" | "sqlite";
  message: string;
}> {
  // 显式指定 SQLite
  if (syncMode === "sqlite") {
    const feeds = await listFeedsFromSqlite(dbPath);
    return {
      feeds,
      source: "sqlite",
      message: `从 SQLite 读取到 ${feeds.length} 个公众号`,
    };
  }

  // 显式指定 API 或自动检测
  if (syncMode === "api" || syncMode === "auto") {
    try {
      const data = await listFeedsApi(baseUrl, accessKey, secretKey, {});
      return {
        feeds: data.list,
        source: "api",
        message: `从 API 读取到 ${data.total} 个公众号`,
      };
    } catch (apiErr) {
      // API 失败，如果是自动模式则尝试 SQLite
      if (syncMode === "auto") {
        const sqliteCheck = await checkSqliteDb(dbPath);
        if (sqliteCheck.readable) {
          const feeds = await listFeedsFromSqlite(dbPath);
          return {
            feeds,
            source: "sqlite",
            message: `API 不可用，从 SQLite 读取到 ${feeds.length} 个公众号`,
          };
        }
      }
      throw apiErr;
    }
  }

  // manual 模式
  return { feeds: [], source: "api", message: "手动模式，不自动同步" };
}

/**
 * 自动检测并获取文章列表。
 * 优先 API，SQLite 只读兜底。
 */
export async function listArticlesAuto(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  syncMode: SyncMode = "auto",
  dbPath: string | undefined,
  params: WeMpRssListArticlesParams
): Promise<{
  articles: WeMpRssArticle[];
  total: number;
  source: "api" | "sqlite";
  message: string;
}> {
  // 显式指定 SQLite
  if (syncMode === "sqlite") {
    const result = await listArticlesFromSqlite(dbPath, params.mpId, {
      offset: params.offset,
      limit: params.limit,
    });
    return {
      articles: result.list,
      total: result.total,
      source: "sqlite",
      message: `从 SQLite 读取到 ${result.total} 篇文章`,
    };
  }

  // 显式指定 API 或自动检测
  if (syncMode === "api" || syncMode === "auto") {
    try {
      const data = await listArticlesApi(baseUrl, accessKey, secretKey, params);
      return {
        articles: data.list,
        total: data.total,
        source: "api",
        message: `从 API 读取到 ${data.total} 篇文章`,
      };
    } catch (apiErr) {
      if (syncMode === "auto") {
        const sqliteCheck = await checkSqliteDb(dbPath);
        if (sqliteCheck.readable) {
          const result = await listArticlesFromSqlite(dbPath, params.mpId, {
            offset: params.offset,
            limit: params.limit,
          });
          return {
            articles: result.list,
            total: result.total,
            source: "sqlite",
            message: `API 不可用，从 SQLite 读取到 ${result.total} 篇文章`,
          };
        }
      }
      throw apiErr;
    }
  }

  // manual 模式
  return { articles: [], total: 0, source: "api", message: "手动模式，不自动同步" };
}
