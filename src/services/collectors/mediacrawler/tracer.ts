/**
 * 原文追溯 — attempt to find the original article URL
 * from B站 or 小红书 content (e.g. reprinted / forwarded articles).
 *
 * Returns the original URL string if found, otherwise null.
 */

/** Regex patterns commonly found in B站 专栏 referencing original sources. */
const BILIBILI_ORIGINAL_URL_PATTERNS = [
  // "原文链接：https://..."
  /(?:原文|原链接|来源|转载自|出处)[：:]\s*(https?:\/\/[^\s<>"']+)/i,
  // Bare URL after a keyword
  /(?:原文|来源|出处)\s*(?:链接)?\s*[：:]\s*\n?\s*(https?:\/\/[^\s<>"']+)/i,
];

/** Regex patterns commonly found in 小红书 notes referencing original sources. */
const XIAOHONGSHU_ORIGINAL_URL_PATTERNS = [
  /(?:原文|原链接|来源|转载自|出处|via)[：:]\s*(https?:\/\/[^\s<>"']+)/i,
  /(?:原文|来源|出处)\s*(?:链接)?\s*[：:]\s*\n?\s*(https?:\/\/[^\s<>"']+)/i,
];

/**
 * Attempt to trace the original article URL from crawled content.
 *
 * @param platform - "bilibili" | "xiaohongshu"
 * @param contentUrl - the crawled content URL (unused for logic, kept for logging)
 * @param fullText - the full text of the crawled content
 * @returns the original URL if found, otherwise null
 */
export async function traceOriginalUrl(
  platform: "bilibili" | "xiaohongshu",
  _contentUrl: string,
  fullText?: string
): Promise<string | null> {
  if (!fullText) return null;

  const patterns =
    platform === "bilibili"
      ? BILIBILI_ORIGINAL_URL_PATTERNS
      : XIAOHONGSHU_ORIGINAL_URL_PATTERNS;

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match?.[1]) {
      const url = match[1].replace(/[),;.!?]+$/, ""); // strip trailing punctuation
      // Basic sanity check: must look like a URL
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
    }
  }

  return null;
}
