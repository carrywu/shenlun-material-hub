import { createHash } from "crypto";
import { db } from "@/lib/db";
import type { WeRssArticle } from "./weRssClient";

interface NormalizeOptions {
  sourceId: string;
  trustLevel?: string;
  contentType?: string;
}

export interface NormalizeResult {
  created: boolean;
  item: { id: string; title: string; originalUrl: string };
}

/**
 * 将 WeRSS 文章转换为 ContentItem 并写入数据库。
 * discoveryChannel = 'subscription'，platform = 'wechat'。
 */
export async function normalizeWeRssArticle(
  article: WeRssArticle,
  options: NormalizeOptions
): Promise<NormalizeResult> {
  const originalUrl = article.url;
  if (!originalUrl) {
    throw new Error(`文章 "${article.title}" 缺少 URL`);
  }

  // 去重
  const existing = await db.contentItem.findUnique({
    where: { originalUrl },
  });
  if (existing) {
    return { created: false, item: existing };
  }

  const fullText = article.content ?? null;
  const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;
  const publishedAt = article.publishTime
    ? new Date(article.publishTime)
    : null;

  const contentHash = fullText
    ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
    : null;

  const item = await db.contentItem.create({
    data: {
      sourceId: options.sourceId,
      title: article.title,
      originalUrl,
      platform: "wechat",
      contentType: options.contentType ?? "policy_analysis",
      trustLevel: options.trustLevel ?? "unverified",
      authorOrAccount: article.author ?? article.accountName ?? null,
      publishedAt,
      section: null,
      excerpt,
      fullText,
      fullTextStored: !!fullText,
      contentHash,
      processingStatus: fullText ? "fetched" : "pending",
      regionScopes: "[]",
      topicTags: "[]",
      discoveryChannel: "subscription",
    },
  });

  return { created: true, item };
}

/**
 * 批量转换 WeRSS 文章
 */
export async function normalizeWeRssArticles(
  articles: WeRssArticle[],
  options: NormalizeOptions
): Promise<{ discovered: number; imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  for (const article of articles) {
    try {
      const { created } = await normalizeWeRssArticle(article, options);
      if (created) imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${article.title}] ${msg}`);
    }
  }

  return { discovered: articles.length, imported, errors };
}
