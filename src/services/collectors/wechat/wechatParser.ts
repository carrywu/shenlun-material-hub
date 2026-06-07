import * as cheerio from "cheerio";
import type { WeRssArticle } from "./weRssClient";

export async function parseWechatArticle(url: string): Promise<WeRssArticle> {
  // 只接受 mp.weixin.qq.com 链接
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "mp.weixin.qq.com") {
      throw new Error(`不支持的链接域名: ${parsed.hostname}，仅支持 mp.weixin.qq.com`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(`无效的链接格式: ${url}`);
    }
    throw err;
  }

  // P2-12: add retry logic for transient network failures
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let response: Response | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) break;
      // Retry on server errors (5xx) and rate limits (429)
      if (response.status < 500 && response.status !== 429) break;
      lastError = new Error(`无法访问文章链接: HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  if (!response || !response.ok) {
    throw lastError ?? new Error(`无法访问文章链接: HTTP ${response?.status ?? "unknown"}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $("#activity-name").text().trim() || $("title").text().trim();
  const content = $("#js_content").html() || "";
  const author = $("#js_name").text().trim() || $(".account_nickname").text().trim();

  // Try to parse publish time from page scripts if possible
  let publishTime: string | undefined;
  const match = html.match(/var ct = "(\d+)";/);
  if (match && match[1]) {
    publishTime = new Date(parseInt(match[1]) * 1000).toISOString();
  }

  // Extract cover image: og:image first, then first image in content
  let cover: string | undefined;
  try {
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      cover = ogImage;
    } else {
      const firstImg = $("#js_content").find("img").first().attr("src");
      if (firstImg) {
        cover = firstImg;
      }
    }
  } catch {
    // Image extraction failure should not block import
  }

  return {
    id: url,
    title,
    url,
    content,
    author,
    publishTime,
    cover,
  };
}
