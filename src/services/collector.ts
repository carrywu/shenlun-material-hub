import axios, { AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import { db } from "@/lib/db";

// 采集到的文章结构
export interface CollectedArticle {
  title: string;
  url: string;
  source: string;
  content: string;
  summary?: string;
  category?: string;
  tags?: string[];
  publishedAt?: Date;
}

// 采集器接口
export interface ArticleCollector {
  sourceName: string;
  collect(): Promise<CollectedArticle[]>;
}

// 来源名称
export type SourceName = "people" | "opinion" | "banyuetan" | "gov";

// 采集结果统计
export interface CollectResult {
  source: string;
  collected: number;
  saved: number;
  skipped: number;
  errors: string[];
}

// 请求限速器
export class RateLimiter {
  private lastRequestTime = 0;
  private intervalMs: number;

  constructor(intervalMs = 2000) {
    this.intervalMs = intervalMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.intervalMs) {
      await new Promise((r) => setTimeout(r, this.intervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

// 创建 axios 实例（带默认 headers）
export function createHttpClient(): AxiosInstance {
  return axios.create({
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
}

// 加载 HTML 并返回 cheerio 实例
export async function fetchAndParse(url: string): Promise<cheerio.CheerioAPI> {
  const client = createHttpClient();
  const response = await client.get(url);
  return cheerio.load(response.data);
}

// 保存采集到的文章到数据库（去重）
export async function saveArticles(
  articles: CollectedArticle[]
): Promise<{ saved: number; skipped: number; errors: string[] }> {
  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const article of articles) {
    try {
      // 检查 URL 是否已存在
      const existing = await db.article.findUnique({
        where: { url: article.url },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.article.create({
        data: {
          title: article.title,
          url: article.url,
          source: article.source,
          content: article.content,
          summary: article.summary ?? null,
          category: article.category ?? "政治",
          tags: article.tags?.join(",") ?? "",
          publishedAt: article.publishedAt ?? null,
        },
      });
      saved++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`保存失败 [${article.title}]: ${msg}`);
    }
  }

  return { saved, skipped, errors };
}
