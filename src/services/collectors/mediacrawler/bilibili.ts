/**
 * B站 (Bilibili) collector via MediaCrawler sidecar.
 *
 * Prioritises 专栏 (article) content over 视频 (video).
 * Uses platform='bilibili' and discoveryChannel='mediacrawler'.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  crawlBilibili,
  getCrawlStatus,
  type CrawlParams,
  type CrawlResultItem,
} from "./client";
import { traceOriginalUrl } from "./tracer";

export interface BilibiliCollectResult {
  sourceId: string;
  runId: string;
  discoveredCount: number;
  importedCount: number;
  errors: string[];
}

/**
 * Persist crawled B站 items as ContentItems.
 *
 * - Articles (专栏) are stored with contentType="article"
 * - Videos are stored with contentType="video"
 * - Articles are imported first (priority over videos)
 */
export async function collectBilibili(
  source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
  },
  userId: string,
  params?: CrawlParams
): Promise<BilibiliCollectResult> {
  const errors: string[] = [];
  let discoveredCount = 0;
  let importedCount = 0;

  // Create CollectorRun record
  const runRecord = await db.collectorRun.create({
    data: {
      sourceId: source.id,
      collectorType: "mediacrawler_bilibili",
      status: "running",
    },
  });

  try {
    // Trigger crawl on MediaCrawler sidecar
    const { runId } = await crawlBilibili(userId, params);

    // Poll until completion (simple loop with back-off)
    let items: CrawlResultItem[] = [];
    let status = "running";
    for (let attempt = 0; attempt < 60 && status === "running"; attempt++) {
      await new Promise((r) =>
        setTimeout(r, Math.min(2000 * Math.pow(1.3, attempt), 15_000))
      );
      const result = await getCrawlStatus(runId);
      status = result.status;
      if (result.error) throw new Error(result.error);
      if (status === "success") items = result.items;
    }

    if (status === "running") {
      throw new Error("MediaCrawler crawl timed out");
    }

    // Sort: articles first, then videos
    const sorted = [...items].sort((a, b) => {
      const aIsArticle = a.type === "article" ? 0 : 1;
      const bIsArticle = b.type === "article" ? 0 : 1;
      return aIsArticle - bIsArticle;
    });

    discoveredCount = sorted.length;

    for (const item of sorted) {
      try {
        const existing = await db.contentItem.findUnique({
          where: { originalUrl: item.url },
        });
        if (existing) continue;

        const fullText = item.content ?? null;
        const excerpt = fullText?.slice(0, 200) ?? null;
        const contentType = item.type === "article" ? "article" : "video";

        // Attempt to find linked original URL (for reprinted content)
        const linkedOriginalUrl = await traceOriginalUrl(
          "bilibili",
          item.url,
          fullText ?? undefined
        );

        await db.contentItem.create({
          data: {
            sourceId: source.id,
            externalContentId: item.id,
            platform: "bilibili",
            contentType,
            trustLevel: source.trustLevel,
            title: item.title,
            authorOrAccount: item.author ?? null,
            originalUrl: item.url,
            publishedAt: item.publishedAt
              ? new Date(item.publishedAt)
              : null,
            section: "B站",
            regionScopes: "[]",
            topicTags: "[]",
            excerpt,
            fullText,
            fullTextStored: !!fullText,
            contentHash: fullText
              ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
              : null,
            processingStatus: fullText ? "fetched" : "pending",
            discoveryChannel: "mediacrawler",
            linkedOriginalId: linkedOriginalUrl ?? null,
          },
        });

        importedCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`[${item.title}] ${msg}`);
      }
    }

    // Update CollectorRun
    await db.collectorRun.update({
      where: { id: runRecord.id },
      data: {
        status: "success",
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
    const errorMsg = error instanceof Error ? error.message : String(error);
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
    runId: runRecord.id,
    discoveredCount,
    importedCount,
    errors,
  };
}
