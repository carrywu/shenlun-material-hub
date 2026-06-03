/**
 * WeWe RSS 集成服务
 * 作为 sidecar 调用本地 WeWe RSS 服务，不合并其源码。
 * 优先使用 API，SQLite 只读兜底。
 */

import { listFeedsFromSqlite, checkSqliteDb } from "./wewe-rss-sqlite";

export interface WeweRssFeed {
  id: string;        // 如 MP_WXS_2397547378
  name: string;      // 公众号名称
  intro?: string;    // 简介
  cover?: string;    // 头像 URL
  syncTime?: number; // 最近同步时间戳
  updateTime?: number; // 最近更新时间戳
}

export type SyncMode = "auto" | "api" | "sqlite" | "manual";

export interface HealthCheckResult {
  reachable: boolean;
  message: string;
  feedCount?: number;
}

/**
 * 标准化 baseUrl，去除末尾斜杠。
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * 构造 feed URL。
 * WeWe RSS 格式: http://localhost:4000/feeds/MP_WXS_xxx.rss
 */
export function buildFeedUrl(
  baseUrl: string,
  feedId: string,
  format: "rss" | "atom" | "json" = "rss"
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/feeds/${feedId}.${format}`;
}

/**
 * 构造带 update=true 的刷新 URL。
 * 如果已有 query 参数，用 & 追加；否则用 ? 追加。
 */
export function buildRefreshUrl(baseUrl: string, feedId: string): string {
  const feedUrl = buildFeedUrl(baseUrl, feedId);
  const separator = feedUrl.includes("?") ? "&" : "?";
  return `${feedUrl}${separator}update=true`;
}

/**
 * 检查 WeWe RSS 是否可达。
 * 通过 GET /feeds/ 判断，返回 200 即可达。
 */
export async function checkHealth(
  baseUrl: string
): Promise<HealthCheckResult> {
  const normalized = normalizeBaseUrl(baseUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${normalized}/feeds/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        reachable: false,
        message: `WeWe RSS 返回 HTTP ${res.status}`,
      };
    }

    const feeds: WeweRssFeed[] = await res.json();
    return {
      reachable: true,
      message: `WeWe RSS 服务可访问，已订阅 ${feeds.length} 个公众号`,
      feedCount: feeds.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      message: `无法连接 WeWe RSS: ${msg}`,
    };
  }
}

/**
 * 获取 WeWe RSS 订阅列表。
 * GET /feeds/ 返回 JSON 数组。
 */
export async function listFeeds(baseUrl: string): Promise<WeweRssFeed[]> {
  const normalized = normalizeBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/feeds/`);

  if (!res.ok) {
    throw new Error(`获取订阅列表失败: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * 刷新单个 feed。
 * GET feeds/xxx.rss?update=true 触发 WeWe RSS 从微信读书拉取最新文章。
 */
export async function refreshFeed(
  baseUrl: string,
  feedId: string
): Promise<void> {
  const refreshUrl = buildRefreshUrl(baseUrl, feedId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(refreshUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`刷新 feed 失败: HTTP ${res.status}`);
    }
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * 自动检测并获取订阅列表。
 * 优先 API，SQLite 只读兜底。
 */
export async function listFeedsAuto(
  baseUrl: string,
  syncMode: SyncMode = "auto",
  dbPath?: string
): Promise<{ feeds: WeweRssFeed[]; source: "api" | "sqlite"; message: string }> {
  // 显式指定 SQLite
  if (syncMode === "sqlite") {
    const feeds = listFeedsFromSqlite(dbPath);
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
        const sqliteCheck = checkSqliteDb(dbPath);
        if (sqliteCheck.readable) {
          const feeds = listFeedsFromSqlite(dbPath);
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
