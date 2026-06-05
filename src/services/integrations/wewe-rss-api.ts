/**
 * WeWe RSS API 服务
 * 只包含 HTTP API 调用能力，不触发 SQLite fallback 依赖。
 */

export interface WeweRssFeed {
  id: string;
  name: string;
  intro?: string;
  cover?: string;
  syncTime?: number;
  updateTime?: number;
}

export interface HealthCheckResult {
  reachable: boolean;
  message: string;
  feedCount?: number;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildFeedUrl(
  baseUrl: string,
  feedId: string,
  format: "rss" | "atom" | "json" = "rss"
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/feeds/${feedId}.${format}`;
}

export function buildRefreshUrl(baseUrl: string, feedId: string): string {
  const feedUrl = buildFeedUrl(baseUrl, feedId);
  const separator = feedUrl.includes("?") ? "&" : "?";
  return `${feedUrl}${separator}update=true`;
}

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

export async function listFeeds(baseUrl: string): Promise<WeweRssFeed[]> {
  const normalized = normalizeBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/feeds/`);

  if (!res.ok) {
    throw new Error(`获取订阅列表失败: HTTP ${res.status}`);
  }

  return res.json();
}

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
