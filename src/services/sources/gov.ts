import {
  ArticleCollector,
  CollectedArticle,
  RateLimiter,
  fetchAndParse,
} from "../collector";

const SOURCE_NAME = "中国政府网";
const LIST_URL = "https://www.gov.cn/";
const rateLimiter = new RateLimiter(3000);

export const govCollector: ArticleCollector = {
  sourceName: SOURCE_NAME,

  async collect(): Promise<CollectedArticle[]> {
    const articles: CollectedArticle[] = [];

    try {
      await rateLimiter.wait();
      const $ = await fetchAndParse(LIST_URL);

      const links: string[] = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const text = $(el).text().trim();
        if (
          text.length >= 4 &&
          (href.includes("gov.cn") || href.startsWith("/")) &&
          !href.includes("javascript:") &&
          /\.(html|shtml)$/.test(href)
        ) {
          const fullUrl = href.startsWith("http")
            ? href
            : new URL(href, LIST_URL).toString();
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

      const targetLinks = links.slice(0, 10);

      for (const url of targetLinks) {
        try {
          await rateLimiter.wait();
          const article = await fetchGovDetail(url);
          if (article) {
            articles.push(article);
          }
        } catch {
          // 单篇失败不中断
        }
      }
    } catch (err) {
      console.error(`[${SOURCE_NAME}] 采集列表失败:`, err);
    }

    return articles;
  },
};

async function fetchGovDetail(url: string): Promise<CollectedArticle | null> {
  try {
    const $ = await fetchAndParse(url);

    const title = $("h1").first().text().trim() || $("title").text().trim();
    if (!title) return null;

    let content = "";
    const contentEl = $(
      ".pages_content, .TRS_Editor, .article, #UCAP-CONTENT, .content"
    ).first();
    if (contentEl.length) {
      content = contentEl
        .find("p")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter((t) => t.length > 0)
        .join("\n");
    }

    if (!content || content.length < 50) return null;

    const timeText =
      $(".pages-date, .pub_date, time, .article-info").first().text() ?? "";
    const dateMatch = timeText.match(/(\d{4})[-年.](\d{1,2})[-月.](\d{1,2})/);
    const publishedAt = dateMatch
      ? new Date(
          `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
        )
      : undefined;

    return {
      title,
      url,
      source: SOURCE_NAME,
      content,
      summary: content.slice(0, 200),
      category: "政治",
      tags: ["政府", "政策"],
      publishedAt,
    };
  } catch {
    return null;
  }
}
