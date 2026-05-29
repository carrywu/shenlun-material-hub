import { createHash } from "crypto";
import { db } from "@/lib/db";

export interface FilterResult {
  filtered: boolean;
  reason?: string;
}

// URL patterns that indicate non-content pages
const URL_FILTER_PATTERNS = [
  /\/category\//i,
  /\/tag\//i,
  /\/tags?\//i,
  /\/page\/\d/i,
  /\/nav\//i,
  /\/navigation/i,
  /\/sitemap/i,
  /\/search\?/i,
  /\/archive\/?$/i,
  /\/list\/?$/i,
  /\/index\.html?$/i,
  /\/about\/?$/i,
  /\/contact\/?$/i,
  /\/links\/?$/i,
];

// Title patterns that indicate non-content pages
const TITLE_PREFIX_PATTERNS = [
  /^栏目[：:]/,
  /^导航[：:]/,
  /^模板[：:]/,
  /^目录[：:]/,
  /^索引[：:]/,
  /^更多>>/,
  /^更多$/,
  /^首页$/,
  /^网站地图$/,
  /^站内导航$/,
  /^栏目列表$/,
];

const TITLE_SUFFIX_PATTERNS = [
  /[-—|]栏目$/,
  /[-—|]导航$/,
  /[-—|]模板$/,
  /[-—|]目录$/,
  /[-—|]索引$/,
  />>$/,
  /列表$/,
  /大全$/,
];

// Minimum content length threshold
const MIN_CONTENT_LENGTH = 100;

/**
 * Check if a URL should be filtered out as a non-content page.
 */
export function checkUrlFilter(url: string): FilterResult {
  for (const pattern of URL_FILTER_PATTERNS) {
    if (pattern.test(url)) {
      return {
        filtered: true,
        reason: `URL 匹配非内容页面模式: ${pattern.source}`,
      };
    }
  }
  return { filtered: false };
}

/**
 * Check if a title should be filtered out as a non-content page.
 */
export function checkTitleFilter(title: string): FilterResult {
  const trimmed = title.trim();

  for (const pattern of TITLE_PREFIX_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        filtered: true,
        reason: `标题匹配非内容前缀模式: ${trimmed.slice(0, 20)}`,
      };
    }
  }

  for (const pattern of TITLE_SUFFIX_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        filtered: true,
        reason: `标题匹配非内容后缀模式: ${trimmed.slice(-20)}`,
      };
    }
  }

  return { filtered: false };
}

/**
 * Check if content is too short to be useful.
 */
export function checkContentLengthFilter(
  fullText: string | null,
  excerpt: string | null
): FilterResult {
  const content = fullText ?? excerpt ?? "";
  // Strip HTML tags and whitespace for length check
  const plainText = content
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (plainText.length < MIN_CONTENT_LENGTH) {
    return {
      filtered: true,
      reason: `内容过短（${plainText.length} 字），不足 ${MIN_CONTENT_LENGTH} 字`,
    };
  }

  return { filtered: false };
}

/**
 * Compute content hash for deduplication.
 */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Check if content is a duplicate based on contentHash.
 */
export async function checkDuplicateFilter(
  contentHash: string | null,
  excludeId?: string
): Promise<FilterResult> {
  if (!contentHash) {
    return { filtered: false };
  }

  const existing = await db.contentItem.findFirst({
    where: {
      contentHash,
      processingStatus: { not: "filtered" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, title: true },
  });

  if (existing) {
    return {
      filtered: true,
      reason: `与已有内容重复（hash: ${contentHash}，标题: ${existing.title.slice(0, 30)}）`,
    };
  }

  return { filtered: false };
}

/**
 * Run all content filters on a content item.
 * Returns the first filter that triggers, or null if content passes all filters.
 */
export async function runContentFilters(
  url: string,
  title: string,
  fullText: string | null,
  excerpt: string | null,
  contentHash: string | null,
  excludeId?: string
): Promise<FilterResult> {
  // 1. URL filter
  const urlResult = checkUrlFilter(url);
  if (urlResult.filtered) return urlResult;

  // 2. Title filter
  const titleResult = checkTitleFilter(title);
  if (titleResult.filtered) return titleResult;

  // 3. Content length filter
  const lengthResult = checkContentLengthFilter(fullText, excerpt);
  if (lengthResult.filtered) return lengthResult;

  // 4. Duplicate filter
  const dupResult = await checkDuplicateFilter(contentHash, excludeId);
  if (dupResult.filtered) return dupResult;

  return { filtered: false };
}

/**
 * Mark a content item as filtered with the given reason.
 */
export async function markAsFiltered(
  contentItemId: string,
  reason: string
): Promise<void> {
  await db.contentItem.update({
    where: { id: contentItemId },
    data: {
      processingStatus: "filtered",
      filterReason: reason,
    },
  });
}

/**
 * Batch filter existing content items.
 * Returns the count of items marked as filtered.
 */
export async function batchFilterContentItems(): Promise<{
  filtered: number;
  total: number;
}> {
  const items = await db.contentItem.findMany({
    where: {
      processingStatus: { not: "filtered" },
    },
    select: {
      id: true,
      title: true,
      originalUrl: true,
      fullText: true,
      excerpt: true,
      contentHash: true,
    },
  });

  let filteredCount = 0;

  for (const item of items) {
    const result = await runContentFilters(
      item.originalUrl,
      item.title,
      item.fullText,
      item.excerpt,
      item.contentHash,
      item.id
    );

    if (result.filtered && result.reason) {
      await markAsFiltered(item.id, result.reason);
      filteredCount++;
    }
  }

  return { filtered: filteredCount, total: items.length };
}
