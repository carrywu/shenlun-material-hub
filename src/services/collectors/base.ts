import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { db } from "@/lib/db";

export interface RawArticle {
  title: string;
  url: string;
  excerpt?: string;
  fullText?: string;
  author?: string;
  publishedAt?: Date;
  section?: string;
}

export interface CollectorResult {
  sourceId: string;
  collectorType: string;
  discoveredCount: number;
  importedCount: number;
  errors: string[];
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export abstract class BaseCollector {
  abstract readonly collectorType: string;
  abstract readonly sourceName: string;

  protected async fetchWithRetry(
    url: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: DEFAULT_HEADERS,
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(r, delayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url}`);
  }

  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  protected computeContentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  protected async normalizeToContentItem(
    raw: RawArticle,
    source: { id: string; platform: string; contentType: string; trustLevel: string }
  ): Promise<{
    created: boolean;
    item: { id: string; title: string; originalUrl: string };
  }> {
    const existing = await db.contentItem.findUnique({
      where: { originalUrl: raw.url },
    });

    if (existing) {
      return { created: false, item: existing };
    }

    const fullText = raw.fullText ?? null;
    const excerpt = raw.excerpt ?? fullText?.slice(0, 200) ?? null;

    const item = await db.contentItem.create({
      data: {
        sourceId: source.id,
        title: raw.title,
        originalUrl: raw.url,
        platform: source.platform,
        contentType: source.contentType,
        trustLevel: source.trustLevel,
        authorOrAccount: raw.author ?? null,
        publishedAt: raw.publishedAt ?? null,
        section: raw.section ?? null,
        excerpt,
        fullText,
        fullTextStored: !!fullText,
        contentHash: fullText ? this.computeContentHash(fullText) : null,
        processingStatus: fullText ? "fetched" : "pending",
        regionScopes: "[]",
        topicTags: "[]",
        discoveryChannel: "web_collector",
      },
    });

    return { created: true, item };
  }

  abstract collect(
    source: { id: string; platform: string; contentType: string; trustLevel: string; baseUrl?: string | null }
  ): Promise<RawArticle[]>;

  async run(source: {
    id: string;
    name: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<CollectorResult> {
    const errors: string[] = [];
    let discoveredCount = 0;
    let importedCount = 0;

    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: this.collectorType,
        status: "running",
      },
    });

    try {
      const articles = await this.collect(source);
      discoveredCount = articles.length;

      for (const article of articles) {
        try {
          const { created } = await this.normalizeToContentItem(article, source);
          if (created) importedCount++;
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);
          errors.push(`[${article.title}] ${msg}`);
        }
      }

      await db.collectorRun.update({
        where: { id: runRecord.id },
        data: {
          status: errors.length > 0 ? "success" : "success",
          finishedAt: new Date(),
          discoveredCount,
          importedCount,
          errorSummary: errors.length > 0 ? errors.join("\n") : null,
        },
      });

      await db.source.update({
        where: { id: source.id },
        data: { lastCollectedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);

      await db.collectorRun.update({
        where: { id: runRecord.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          discoveredCount,
          importedCount,
          errorSummary: errorMsg,
        },
      });

      await db.source.update({
        where: { id: source.id },
        data: { lastError: errorMsg },
      });
    }

    return {
      sourceId: source.id,
      collectorType: this.collectorType,
      discoveredCount,
      importedCount,
      errors,
    };
  }
}
