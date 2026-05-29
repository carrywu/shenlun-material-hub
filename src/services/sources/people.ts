import {
  ArticleCollector,
  CollectedArticle,
  RateLimiter,
  fetchAndParse,
  createHttpClient,
} from "../collector";

const SOURCE_NAME = "人民日报";
const LIST_URL = "http://www.people.com.cn/";
const rateLimiter = new RateLimiter(3000);

export const peopleCollector: ArticleCollector = {
  sourceName: SOURCE_NAME,

  async collect(): Promise<CollectedArticle[]> {
    const articles: CollectedArticle[] = [];

    try {
      await rateLimiter.wait();
      const $ = await fetchAndParse(LIST_URL);

      // 人民网首页新闻链接
      const links: string[] = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const text = $(el).text().trim();
        // 筛选有效的新闻链接（含 people.com.cn 且有实质文字标题）
        if (
          text.length >= 4 &&
          (href.includes("people.com.cn") || href.startsWith("/")) &&
          !href.includes("javascript:") &&
          !href.includes("#") &&
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

      // 只取前 10 篇
      const targetLinks = links.slice(0, 10);

      for (const url of targetLinks) {
        try {
          await rateLimiter.wait();
          const article = await fetchArticleDetail(url);
          if (article) {
            articles.push(article);
          }
        } catch {
          // 单篇文章失败不中断
        }
      }
    } catch (err) {
      console.error(`[${SOURCE_NAME}] 采集列表失败:`, err);
    }

    return articles;
  },
};

async function fetchArticleDetail(
  url: string
): Promise<CollectedArticle | null> {
  try {
    const $ = await fetchAndParse(url);

    const title = $("h1").first().text().trim() || $("title").text().trim();
    if (!title) return null;

    // 正文内容：人民网通常用 .rm_txt_con 或 #rwb_zw
    let content = "";
    const contentEl = $(".rm_txt_con, #rwb_zw, .text_con, .content").first();
    if (contentEl.length) {
      content = contentEl
        .find("p")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter((t) => t.length > 0)
        .join("\n");
    }

    if (!content || content.length < 50) return null;

    // 发布时间
    const timeText =
      $(".rm_txt_con .fl, .article-info time, .pub_date").first().text() ?? "";
    const dateMatch = timeText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
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
      tags: ["人民日报"],
      publishedAt,
    };
  } catch {
    return null;
  }
}
