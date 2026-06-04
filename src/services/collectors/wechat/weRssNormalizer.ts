import { createHash } from "crypto";
import * as cheerio from "cheerio";
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
 * 清洗微信公众号文章 HTML，提取干净的正文文本和 HTML 片段。
 */
export function cleanWechatHtml(html: string): { fullText: string; rawHtml: string } {
  if (!html) {
    return { fullText: "", rawHtml: "" };
  }

  // 如果不包含任何 HTML 标签，直接返回文本
  if (!/<[a-z/][^>]*>/i.test(html)) {
    return { fullText: html.trim(), rawHtml: html };
  }

  const $ = cheerio.load(html);

  // 查找微信文章的正文容器
  const contentEl = $("#js_content").length > 0
    ? $("#js_content")
    : $(".rich_media_content").length > 0
      ? $(".rich_media_content")
      : $("article").length > 0
        ? $("article")
        : $("body").length > 0
          ? $("body")
          : $("html");

  // 提取原始 HTML 片段作为 rawHtml
  const rawHtml = contentEl.html() || html;

  // 清洗：移除 script, style, head, iframe, noscript, svg, link, meta
  contentEl.find("script, style, head, iframe, noscript, svg, link, meta").remove();

  // 提取干净的正文文本，保留段落换行
  const paragraphs: string[] = [];
  const blocks = contentEl.find("p, section, h1, h2, h3, h4, h5, h6, li, tr");

  if (blocks.length > 0) {
    blocks.each((_, el) => {
      // 避免重复提取嵌套块的文本
      const hasBlockChild = $(el).find("p, section, h1, h2, h3, h4, h5, h6, li, tr").length > 0;
      if (!hasBlockChild) {
        const txt = $(el).text().trim();
        if (txt) {
          paragraphs.push(txt);
        }
      }
    });
  }

  let fullText = paragraphs.join("\n\n");
  if (!fullText) {
    // 兜底：直接取 cleaned contentEl 的文本
    fullText = contentEl.text().trim();
  }

  // 格式化段落多余空格
  fullText = fullText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n\n");

  return { fullText, rawHtml };
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

  // 清洗正文
  const cleaned = cleanWechatHtml(article.content ?? "");
  const fullText = cleaned.fullText || null;
  const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;

  const contentHash = fullText
    ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
    : null;

  // 正文长度（清洗后直接统计）
  const effectiveTextLength = fullText
    ? fullText.replace(/\s+/g, "").trim().length
    : 0;

  const contentPreview = fullText
    ? fullText.replace(/\s+/g, " ").trim().slice(0, 200)
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

  // 清洗正文
  const cleaned = cleanWechatHtml(article.content ?? "");
  const fullText = cleaned.fullText || null;
  const rawHtml = cleaned.rawHtml || null;
  const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;
  const publishedAt = article.publishTime
    ? new Date(article.publishTime)
    : null;

  const contentHash = fullText
    ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
    : null;

  // 正文字数直接按清洗后计算
  const effectiveTextLength = fullText
    ? fullText.replace(/\s+/g, "").trim().length
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
        rawHtml,
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
      rawHtml,
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
