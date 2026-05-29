/**
 * MediaCrawler Python sidecar API client.
 *
 * Talks to the MediaCrawler HTTP service (default http://127.0.0.1:8002)
 * to trigger B站 / 小红书 crawls and poll their status.
 */

export interface CrawlParams {
  keywords?: string[];
  maxCount?: number;
  crawlType?: "user" | "search" | "detail";
  startPage?: number;
}

export interface CrawlResultItem {
  id: string;
  title: string;
  url: string;
  content?: string;
  author?: string;
  publishedAt?: string;
  type?: string; // "article" | "video" | "note"
  platform?: string;
  extra?: Record<string, unknown>;
}

export interface CrawlStatusResponse {
  runId: string;
  status: "running" | "success" | "failed";
  discoveredCount: number;
  items: CrawlResultItem[];
  error?: string;
}

const BASE_URL =
  process.env.MEDIACRAWLER_BASE_URL ?? "http://127.0.0.1:8002";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MediaCrawler ${res.status}: ${body || res.statusText}`
    );
  }

  return (await res.json()) as T;
}

/** Test connectivity to the MediaCrawler sidecar. */
export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Trigger a B站 crawl for the given user. */
export async function crawlBilibili(
  userId: string,
  params?: CrawlParams
): Promise<{ runId: string }> {
  return request<{ runId: string }>("/api/crawl/bilibili", {
    method: "POST",
    body: JSON.stringify({ userId, ...params }),
  });
}

/** Trigger a 小红书 crawl for the given user. */
export async function crawlXiaohongshu(
  userId: string,
  params?: CrawlParams
): Promise<{ runId: string }> {
  return request<{ runId: string }>("/api/crawl/xiaohongshu", {
    method: "POST",
    body: JSON.stringify({ userId, ...params }),
  });
}

/** Poll the status / results of a crawl run. */
export async function getCrawlStatus(
  runId: string
): Promise<CrawlStatusResponse> {
  return request<CrawlStatusResponse>(`/api/crawl/status/${runId}`);
}
