/**
 * we-mp-rss API 服务
 * 通过 AK-SK 认证访问 we-mp-rss (rachelos/we-mp-rss) 的 REST API。
 * 不包含 SQLite fallback 逻辑（见 we-mp-rss-sqlite.ts）。
 */

// ── 常量 ────────────────────────────────────────────────────────────────

export const FEATURED_MP_ID = "MP_WXS_FEATURED_ARTICLES";
export const SYNC_ARTICLE_LIMIT = 100;
export const IMPORT_POLL_TIMEOUT = 120_000;
export const IMPORT_POLL_INTERVAL = 3_000;
export const REFRESH_DEBOUNCE_MS = 30_000;
export const REFRESH_RATE_LIMIT_S = 60;
export const AUTH_EXPIRED_RATIO = 0.5;

// ── 类型 ────────────────────────────────────────────────────────────────

export interface WeMpRssFeed {
  id: string;
  mpName: string;
  mpCover?: string;
  mpIntro?: string;
  status: number;       // 1=启用, 0=禁用
  syncTime?: number;
  updateTime?: number;
  createdAt?: number;
}

export interface WeMpRssArticle {
  id: string;
  mpId: string;
  title: string;
  picUrl?: string;
  url: string;
  description?: string;
  content?: string;       // 已清洗 HTML（GATHER_CLEAN_HTML=True）
  contentHtml?: string;   // 原始 HTML
  hasContent: number;      // 0=缺失, 1=已有
  fixFailCount: number;
  publishTime?: number;
  createdAt?: number;
}

export interface WeMpRssTaskResult {
  taskId: string;
  status: string;
  message?: string;
}

export interface WeMpRssListFeedsParams {
  limit?: number;
  offset?: number;
  kw?: string;
  status?: number;
}

export interface WeMpRssListArticlesParams {
  mpId: string;
  offset?: number;
  limit?: number;
  hasContent?: number;
}

export interface HealthCheckResult {
  reachable: boolean;
  message: string;
  feedCount?: number;
  authStatus: "valid" | "expired" | "unknown";
}

export interface ContentHealth {
  totalArticles: number;
  missingContent: number;
  ratio: number;
}

// ── 内部工具 ─────────────────────────────────────────────────────────────

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildAuthHeader(accessKey: string, secretKey: string): string {
  return `AK-SK ${accessKey}:${secretKey}`;
}

interface WeMpRssResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function request<T>(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(accessKey, secretKey),
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      throw new WeMpRssAuthError(
        `API 认证失败，请检查 Access Key / Secret Key 配置 (HTTP ${res.status})`
      );
    }

    if (!res.ok) {
      throw new WeMpRssApiError(
        `we-mp-rss API 请求失败: HTTP ${res.status} ${res.statusText}`,
        res.status
      );
    }

    const body = (await res.json()) as WeMpRssResponse<T>;
    if (body.code !== 0) {
      throw new WeMpRssApiError(
        `we-mp-rss API 返回错误: code=${body.code}, message=${body.message}`,
        body.code
      );
    }
    return body.data;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof WeMpRssAuthError || err instanceof WeMpRssApiError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw new WeMpRssApiError(
        `we-mp-rss 服务不可达，请检查容器状态和端口: ${msg}`,
        0
      );
    }
    throw err;
  }
}

export class WeMpRssApiError extends Error {
  constructor(message: string, public readonly code: number) {
    super(message);
    this.name = "WeMpRssApiError";
  }
}

export class WeMpRssAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeMpRssAuthError";
  }
}

// ── API 函数 ─────────────────────────────────────────────────────────────

/** 健康检查：调 GET /api/mps?limit=1，同时判断 authStatus */
export async function checkHealth(
  baseUrl: string,
  accessKey: string,
  secretKey: string
): Promise<HealthCheckResult> {
  try {
    const data = await request<{ list: WeMpRssFeed[]; total: number }>(
      baseUrl,
      accessKey,
      secretKey,
      "/api/mps?limit=1"
    );
    return {
      reachable: true,
      message: `we-mp-rss 服务可访问，已订阅 ${data.total} 个公众号`,
      feedCount: data.total,
      authStatus: "valid",
    };
  } catch (err) {
    if (err instanceof WeMpRssAuthError) {
      return {
        reachable: true,
        message: err.message,
        authStatus: "expired",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      message: msg,
      authStatus: "unknown",
    };
  }
}

/** 获取公众号列表 */
export async function listFeeds(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  params: WeMpRssListFeedsParams = {}
): Promise<{ list: WeMpRssFeed[]; total: number; page: number }> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.kw) searchParams.set("kw", params.kw);
  if (params.status !== undefined) searchParams.set("status", String(params.status));

  const qs = searchParams.toString();
  return request(baseUrl, accessKey, secretKey, `/api/mps${qs ? `?${qs}` : ""}`);
}

/** 获取公众号详情 */
export async function getFeedDetail(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  mpId: string
): Promise<WeMpRssFeed> {
  return request(baseUrl, accessKey, secretKey, `/api/mps/${mpId}`);
}

/** 触发公众号同步（注意：GET 请求，不是 POST） */
export async function triggerFeedSync(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  mpId: string,
  options?: { startPage?: number; endPage?: number }
): Promise<WeMpRssTaskResult> {
  const searchParams = new URLSearchParams();
  if (options?.startPage !== undefined) searchParams.set("start_page", String(options.startPage));
  if (options?.endPage !== undefined) searchParams.set("end_page", String(options.endPage));

  const qs = searchParams.toString();
  // we-mp-rss 用 GET 触发同步，不是 POST
  const data = await request<{ task_id?: string; message?: string }>(
    baseUrl,
    accessKey,
    secretKey,
    `/api/mps/update/${mpId}${qs ? `?${qs}` : ""}`
  );
  return {
    taskId: data.task_id ?? mpId,
    status: "pending",
    message: data.message,
  };
}

/** 搜索公众号 */
export async function searchFeeds(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  kw: string
): Promise<{ list: WeMpRssFeed[]; total: number }> {
  return request(baseUrl, accessKey, secretKey, `/api/mps/search/${encodeURIComponent(kw)}`);
}

/** 添加公众号 */
export async function addFeed(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  url: string
): Promise<WeMpRssTaskResult> {
  const data = await request<{ task_id?: string; message?: string }>(
    baseUrl,
    accessKey,
    secretKey,
    "/api/mps",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
  return {
    taskId: data.task_id ?? "",
    status: "pending",
    message: data.message,
  };
}

/** 删除公众号 */
export async function deleteFeed(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  mpId: string
): Promise<{ message: string }> {
  return request(baseUrl, accessKey, secretKey, `/api/mps/${mpId}`, {
    method: "DELETE",
  });
}

/** 获取文章列表 */
export async function listArticles(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  params: WeMpRssListArticlesParams
): Promise<{ list: WeMpRssArticle[]; total: number; page: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("mp_id", params.mpId);
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.hasContent !== undefined) searchParams.set("has_content", String(params.hasContent));

  return request(
    baseUrl,
    accessKey,
    secretKey,
    `/api/articles?${searchParams.toString()}`
  );
}

/** 获取文章详情 */
export async function getArticle(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  articleId: string
): Promise<WeMpRssArticle> {
  return request(baseUrl, accessKey, secretKey, `/api/articles/${articleId}`);
}

/** 刷新文章内容（异步，返回 task_id） */
export async function refreshArticle(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  articleId: string
): Promise<WeMpRssTaskResult> {
  const data = await request<{ task_id: string; message?: string }>(
    baseUrl,
    accessKey,
    secretKey,
    `/api/articles/${articleId}/refresh`,
    { method: "POST" }
  );
  return {
    taskId: data.task_id,
    status: "pending",
    message: data.message,
  };
}

/** 获取刷新任务状态 */
export async function getRefreshTaskStatus(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  taskId: string
): Promise<WeMpRssTaskResult> {
  const data = await request<{
    task_id: string;
    status: string;
    message?: string;
  }>(baseUrl, accessKey, secretKey, `/api/articles/refresh/tasks/${taskId}`);
  return {
    taskId: data.task_id,
    status: data.status,
    message: data.message,
  };
}

/** 手动导入文章（异步，返回 task_id） */
export async function importArticle(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  url: string
): Promise<WeMpRssTaskResult> {
  const data = await request<{ task_id: string; message?: string }>(
    baseUrl,
    accessKey,
    secretKey,
    "/api/mps/featured/article",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
  return {
    taskId: data.task_id,
    status: "pending",
    message: data.message,
  };
}

/** 获取导入任务状态 */
export async function getImportTaskStatus(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  taskId: string
): Promise<WeMpRssTaskResult> {
  const data = await request<{
    task_id: string;
    status: string;
    message?: string;
  }>(baseUrl, accessKey, secretKey, `/api/mps/featured/article/tasks/${taskId}`);
  return {
    taskId: data.task_id,
    status: data.status,
    message: data.message,
  };
}

/** 统计最近 100 篇文章中 content 缺失比例，用于 authStatus 降级判断 (Q3) */
export async function getContentHealth(
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  mpId: string
): Promise<ContentHealth> {
  try {
    const data = await listArticles(baseUrl, accessKey, secretKey, {
      mpId,
      limit: SYNC_ARTICLE_LIMIT,
      offset: 0,
    });
    const total = data.list.length;
    const missing = data.list.filter((a) => a.hasContent === 0).length;
    return {
      totalArticles: total,
      missingContent: missing,
      ratio: total > 0 ? missing / total : 0,
    };
  } catch {
    return { totalArticles: 0, missingContent: 0, ratio: 0 };
  }
}
