import { createHash } from "crypto";
import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
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
 * 微信封禁/验证页面的特征关键词。
 * 当 WeWe RSS 服务器被微信反爬封禁时，返回的文章内容为验证页面，
 * 清洗后文本包含这些关键词。此时应明确提示"封禁"，而非当作"全文过短"跳过。
 */
const WECHAT_BLOCK_KEYWORDS = [
  "环境异常",
  "验证后即可继续",
  "完成验证后即可继续访问",
  "当前环境异常",
  "频繁访问",
  "请先验证",
  "为你的访问安全",
];

/**
 * 检测清洗后的文本是否为微信封禁/验证页面。
 */
export function detectWechatBlockPage(fullText: string | null): boolean {
  if (!fullText) return false;
  // 封禁页面特征：文本很短（< 200 字）且包含验证关键词
  if (fullText.replace(/\s+/g, "").length > 200) return false;
  return WECHAT_BLOCK_KEYWORDS.some((kw) => fullText.includes(kw));
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

  // 封禁检测：先于"全文过短"检查，明确区分封禁与正常短文
  if (detectWechatBlockPage(fullText)) {
    return {
      id: article.id ?? originalUrl,
      title: article.title ?? "(无标题)",
      url: originalUrl,
      author: article.author ?? article.accountName,
      publishTime: article.publishTime,
      cover: article.cover,
      effectiveTextLength,
      filtered: true,
      filterReason: "微信封禁/验证页面，文章内容无法获取",
      contentPreview,
      isDuplicate,
    };
  }

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
    // 封禁文章：WeWe RSS 可能已有正确内容，尝试更新
    if (existing.qualityStatus === "blocked") {
      // 先清洗新内容，判断是否仍是封禁页面
      const cleaned = cleanWechatHtml(article.content ?? "");
      const fullText = cleaned.fullText || null;

      if (detectWechatBlockPage(fullText)) {
        // 新内容仍是封禁页面，不更新
        await logger.info("采集跳过：封禁页面未更新", "CRAWLER", {
          sourceId: options.sourceId,
          title: article.title,
          url: originalUrl,
          existingStatus: existing.qualityStatus,
        });
        return { created: false, item: existing };
      }

      // 新内容正常：更新旧记录，保留 id / 用户数据
      const contentHash = fullText
        ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
        : null;
      const effectiveTextLength = fullText
        ? fullText.replace(/\s+/g, "").trim().length
        : 0;
      const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;

      const updated = await db.contentItem.update({
        where: { id: existing.id },
        data: {
          fullText,
          rawHtml: cleaned.rawHtml || null,
          excerpt,
          contentHash,
          fullTextStored: !!fullText,
          effectiveTextLength,
          coverUrl: article.cover ?? existing.coverUrl,
          // 重置状态：从封禁回到待检测
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          // 清除旧 AI 评估结果（内容已变，旧评估失效）
          aiDecision: null,
          aiReason: null,
          aiAssessedAt: null,
          aiAssessmentError: null,
          aiScore: null,
          aiScoreDetail: null,
          aiScoredAt: null,
          contentGenre: null,
          aiCategories: null,
          aiUsableFor: null,
          aiSummary: null,
          aiQuotes: null,
          adminReviewStatus: "pending_ai",
        },
      });

      await logger.info("采集刷新：封禁文章已更新", "CRAWLER", {
        sourceId: options.sourceId,
        title: article.title,
        url: originalUrl,
        previousQualityStatus: existing.qualityStatus,
        newQualityStatus: "pending",
        effectiveTextLength,
      });

      return { created: false, filtered: false, item: updated };
    }

    // 非封禁文章：保持原有跳过逻辑
    await logger.info("采集跳过：URL 已存在", "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      existingStatus: existing.processingStatus,
    });
    return { created: false, filtered: true, filterReason: "URL 已存在（重复）", item: existing };
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

  // 封禁检测：先于"全文过短"检查，明确区分封禁与正常短文
  if (detectWechatBlockPage(fullText)) {
    const reason = "微信封禁/验证页面，文章内容无法获取";
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
        processingStatus: "blocked",
        filterReason: reason,
        qualityStatus: "blocked",
        effectiveTextLength,
        regionScopes: "[]",
        topicTags: "[]",
        discoveryChannel: "werss",
        coverUrl: article.cover ?? null,
      },
    });

    await logger.warn("采集封禁：微信验证页", "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      effectiveTextLength,
    });
    return { created: true, filtered: true, filterReason: reason, item };
  }

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

    await logger.info("采集跳过：全文过短", "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      effectiveTextLength,
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

  // C2: 同批竞态兜底——若同 contentHash 的记录在过滤器运行期间刚被 create，
  // 这里再查一次，避免重复入库（不同 URL 同正文的情况）。
  if (!filterResult.filtered && contentHash) {
    const dupByHash = await db.contentItem.findFirst({
      where: { contentHash, id: { not: undefined } },
      select: { id: true, title: true, originalUrl: true },
    });
    if (dupByHash && dupByHash.originalUrl !== originalUrl) {
      filterResult = {
        filtered: true,
        reason: `与已有内容重复（hash: ${contentHash}，标题: ${dupByHash.title.slice(0, 30)}）`,
      };
    }
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

  if (filterResult.filtered) {
    await logger.info(`采集跳过：${filterResult.reason ?? "过滤器命中"}`, "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      effectiveTextLength,
    });
  } else {
    await logger.info("采集导入成功", "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      effectiveTextLength,
      contentHash,
    });
  }

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
): Promise<{ discovered: number; imported: number; skipped: number; blocked: number; refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let blocked = 0;
  let refreshed = 0;

  for (const article of articles) {
    try {
      const result = await normalizeWeRssArticle(article, options);
      if (result.created && !result.filtered) {
        imported++;
      } else if (result.filterReason?.includes("封禁")) {
        blocked++;
      } else if (!result.created && !result.filtered && !result.filterReason) {
        // 封禁文章被刷新成功：created=false, filtered=false, no filterReason
        refreshed++;
      } else {
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${article.title}] ${msg}`);
    }
  }

  return { discovered: articles.length, imported, skipped, blocked, refreshed, errors };
}
