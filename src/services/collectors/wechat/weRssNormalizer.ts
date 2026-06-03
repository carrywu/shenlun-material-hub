import { createHash } from "crypto";
import { db } from "@/lib/db";
import { runContentFilters } from "@/services/content-filter";
import type { WeRssArticle } from "./weRssClient";

interface NormalizeOptions {
  sourceId: string;
  trustLevel?: string;
  contentType?: string;
}

export interface NormalizeResult {
  created: boolean;
  filtered?: boolean;
  filterReason?: string;
  item: { id: string; title: string; originalUrl: string };
}

export interface PreviewArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishTime?: string;
  cover?: string;
  effectiveTextLength: number;
  filtered: boolean;
  filterReason?: string;
  contentPreview: string;
  isDuplicate: boolean;
}

/**
 * 纯计算：对单篇文章运行所有过滤逻辑，不写数据库。
 * 用于预览阶段展示 title / 字数 / 过滤原因。
 */
export async function computeArticlePreview(
  article: WeRssArticle
): Promise<PreviewArticle> {
  const originalUrl = article.url;
  if (!originalUrl) {
    return {
      id: article.id ?? "",
      title: article.title ?? "(无标题)",
      url: "",
      effectiveTextLength: 0,
      filtered: true,
      filterReason: "缺少 URL",
      contentPreview: "",
      isDuplicate: false,
    };
  }

  // URL 去重
  const existing = await db.contentItem.findUnique({
    where: { originalUrl },
    select: { id: true },
  });
  const isDuplicate = !!existing;

  const fullText = article.content ?? null;
  const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;

  const contentHash = fullText
    ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
    : null;

  const effectiveTextLength = fullText
    ? fullText.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim().length
    : 0;

  const contentPreview = fullText
    ? fullText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200)
    : "";

  // 质量门控
  if (!fullText || effectiveTextLength < 300) {
    const reason = !fullText
      ? "无全文内容（采集器未获取到正文）"
      : `全文过短（${effectiveTextLength} 字），不足 300 字`;
    return {
      id: article.id ?? originalUrl,
      title: article.title ?? "(无标题)",
      url: originalUrl,
      author: article.author ?? article.accountName,
      publishTime: article.publishTime,
      cover: article.cover,
      effectiveTextLength,
      filtered: true,
      filterReason: reason,
      contentPreview,
      isDuplicate,
    };
  }

  // 内容过滤器
  let filterResult: { filtered: boolean; reason?: string } = { filtered: false };
  try {
    filterResult = await runContentFilters(
      originalUrl,
      article.title ?? "",
      fullText,
      excerpt,
      contentHash
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    filterResult = { filtered: true, reason: `内容过滤器执行失败: ${msg}` };
  }

  return {
    id: article.id ?? originalUrl,
    title: article.title ?? "(无标题)",
    url: originalUrl,
    author: article.author ?? article.accountName,
    publishTime: article.publishTime,
    cover: article.cover,
    effectiveTextLength,
    filtered: isDuplicate || filterResult.filtered,
    filterReason: isDuplicate
      ? "URL 已存在（重复）"
      : filterResult.reason,
    contentPreview,
    isDuplicate,
  };
}

/**
 * 将 WeRSS 文章转换为 ContentItem 并写入数据库。
 * discoveryChannel = 'werss'，platform = 'wechat'。
 * 接入 runContentFilters 进行 contentHash 去重和内容质量检查。
 */
export async function normalizeWeRssArticle(
  article: WeRssArticle,
  options: NormalizeOptions
): Promise<NormalizeResult> {
  const originalUrl = article.url;
  if (!originalUrl) {
    throw new Error(`文章 "${article.title}" 缺少 URL`);
  }

  // 去重：URL 唯一性
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

  const effectiveTextLength = fullText
    ? fullText.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim().length
    : 0;

  // 质量门控：无全文或全文过短（<300字）直接标记为 filtered
  if (!fullText || effectiveTextLength < 300) {
    const reason = !fullText
      ? "无全文内容（采集器未获取到正文）"
      : `全文过短（${effectiveTextLength} 字），不足 300 字`;

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
        processingStatus: "filtered",
        filterReason: reason,
        qualityStatus: "filtered",
        effectiveTextLength,
        regionScopes: "[]",
        topicTags: "[]",
        discoveryChannel: "werss",
        coverUrl: article.cover ?? null,
      },
    });

    return { created: true, filtered: true, filterReason: reason, item };
  }

  // 运行内容过滤器（URL/title/length/navigation/duplicate）
  let filterResult: { filtered: boolean; reason?: string } = { filtered: false };
  try {
    filterResult = await runContentFilters(
      originalUrl,
      article.title,
      fullText,
      excerpt,
      contentHash
    );
  } catch (err) {
    // content filter 报错时记录但不阻塞入库
    const msg = err instanceof Error ? err.message : String(err);
    filterResult = { filtered: true, reason: `内容过滤器执行失败: ${msg}` };
  }

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
      processingStatus: filterResult.filtered ? "filtered" : "fetched",
      filterReason: filterResult.reason ?? null,
      qualityStatus: filterResult.filtered ? "filtered" : "candidate",
      effectiveTextLength,
      regionScopes: "[]",
      topicTags: "[]",
      discoveryChannel: "werss",
      coverUrl: article.cover ?? null,
    },
  });

  return {
    created: true,
    filtered: filterResult.filtered,
    filterReason: filterResult.reason,
    item,
  };
}

/**
 * 批量转换 WeRSS 文章
 */
export async function normalizeWeRssArticles(
  articles: WeRssArticle[],
  options: NormalizeOptions
): Promise<{ discovered: number; imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      const result = await normalizeWeRssArticle(article, options);
      if (result.created && !result.filtered) {
        imported++;
      } else {
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${article.title}] ${msg}`);
    }
  }

  return { discovered: articles.length, imported, skipped, errors };
}
