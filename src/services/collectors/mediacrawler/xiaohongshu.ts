/**
 * 小红书 (Xiaohongshu / RED) collector via MediaCrawler sidecar.
 *
 * Uses platform='xiaohongshu' and discoveryChannel='mediacrawler'.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  crawlXiaohongshu,
  getCrawlStatus,
  type CrawlParams,
  type CrawlResultItem,
} from "./client";
import { traceOriginalUrl } from "./tracer";

export interface XiaohongshuCollectResult {
  sourceId: string;
  runId: string;
  discoveredCount: number;
  importedCount: number;
  errors: string[];
}

/**
 * Persist crawled 小红书 items as ContentItems.
 */
export async function collectXiaohongshu(
  source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
  },
  userId: string,
  params?: CrawlParams
): Promise<XiaohongshuCollectResult> {
  const errors: string[] = [];
  let discoveredCount = 0;
  let importedCount = 0;
  let filteredCount = 0;

  // Create CollectorRun record
  const runRecord = await db.collectorRun.create({
    data: {
      sourceId: source.id,
      collectorType: "mediacrawler_xiaohongshu",
      status: "running",
    },
  });

  try {
    // Trigger crawl on MediaCrawler sidecar
    const { runId } = await crawlXiaohongshu(userId, params);

    // Poll until completion — P1-9 fix: add absolute 5-minute wall-clock timeout
    const MAX_POLL_MS = 5 * 60 * 1000;
    const pollStart = Date.now();
    let items: CrawlResultItem[] = [];
    let status = "running";
    for (let attempt = 0; attempt < 60 && status === "running"; attempt++) {
      if (Date.now() - pollStart > MAX_POLL_MS) break;
      await new Promise((r) =>
        setTimeout(r, Math.min(2000 * Math.pow(1.3, attempt), 15_000))
      );
      const result = await getCrawlStatus(runId);
      status = result.status;
      if (result.error) throw new Error(result.error);
      if (status === "success") items = result.items;
    }

    if (status === "running") {
      throw new Error("MediaCrawler 小红书采集超时（5 分钟上限）");
    }

    discoveredCount = items.length;

    for (const item of items) {
      try {
        const existing = await db.contentItem.findUnique({
          where: { originalUrl: item.url },
        });
        if (existing) continue;

        const fullText = item.content ?? null;
        const excerpt = fullText?.slice(0, 200) ?? null;

        // P1-8 fix: quality gate — skip items with insufficient text
        const effectiveTextLength = fullText ? fullText.replace(/\s/g, "").length : 0;
        if (effectiveTextLength < 300) {
          filteredCount++;
          continue;
        }

        // Attempt to find linked original URL
        const linkedOriginalUrl = await traceOriginalUrl(
          "xiaohongshu",
          item.url,
          fullText ?? undefined
        );

        await db.contentItem.create({
          data: {
            sourceId: source.id,
            externalContentId: item.id,
            platform: "xiaohongshu",
            contentType: "note",
            trustLevel: source.trustLevel,
            title: item.title,
            authorOrAccount: item.author ?? null,
            originalUrl: item.url,
            publishedAt: item.publishedAt
              ? new Date(item.publishedAt)
              : null,
            section: "小红书",
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
