/**
 * WeWe RSS 集成服务
 * 作为 sidecar 调用本地 WeWe RSS 服务，不合并其源码。
 * 优先使用 API，SQLite 只读兜底。
 */

import { listFeeds, type WeweRssFeed } from "./wewe-rss-api";

export type SyncMode = "auto" | "api" | "sqlite" | "manual";

export {
  buildFeedUrl,
  buildRefreshUrl,
  checkHealth,
  listFeeds,
  normalizeBaseUrl,
  refreshFeed,
} from "./wewe-rss-api";

/**
 * 自动检测并获取订阅列表。
 * 优先 API，SQLite 只读兜底。
 */
export async function listFeedsAuto(
  baseUrl: string,
  syncMode: SyncMode = "auto",
  dbPath?: string
): Promise<{ feeds: WeweRssFeed[]; source: "api" | "sqlite"; message: string }> {
  async function readFeedsFromSqlite() {
    const { listFeedsFromSqlite } = await import("./wewe-rss-sqlite");
    return await listFeedsFromSqlite(dbPath);
  }

  // 显式指定 SQLite
  if (syncMode === "sqlite") {
    const feeds = await readFeedsFromSqlite();
    return {
      feeds: feeds.map((f) => ({
        id: f.id,
        name: f.name,
        intro: f.intro,
        cover: f.cover,
        syncTime: f.syncTime,
        updateTime: f.updateTime,
      })),
      source: "sqlite",
      message: `从 SQLite 读取到 ${feeds.length} 个公众号`,
    };
  }

  // 显式指定 API 或自动检测
  if (syncMode === "api" || syncMode === "auto") {
    try {
      const feeds = await listFeeds(baseUrl);
      return {
        feeds,
        source: "api",
        message: `从 API 读取到 ${feeds.length} 个公众号`,
      };
    } catch (apiErr) {
      // API 失败，如果是自动模式则尝试 SQLite
      if (syncMode === "auto") {
        const { checkSqliteDb } = await import("./wewe-rss-sqlite");
        const sqliteCheck = await checkSqliteDb(dbPath);
        if (sqliteCheck.readable) {
          const feeds = await readFeedsFromSqlite();
          return {
            feeds: feeds.map((f) => ({
              id: f.id,
              name: f.name,
              intro: f.intro,
              cover: f.cover,
              syncTime: f.syncTime,
              updateTime: f.updateTime,
            })),
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
