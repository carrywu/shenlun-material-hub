import { BaseCollector, type RawArticle } from "../base";

const BASE_URL = "http://www.gd.gov.cn";

export class GuangdongOfficialCollector extends BaseCollector {
  readonly collectorType = "guangdong_official";
  readonly sourceName = "广东省政府网";

  async collect(source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<RawArticle[]> {
    // 广东省政府网站 - 要闻动态
    const listHtml = await this.fetchWithRetry(BASE_URL);
    const $ = this.parseHtml(listHtml);
    const articles: RawArticle[] = [];
    const seen = new Set<string>();

    // 广东省政府网文章链接含 content/post_ 或 /zwgk/
    $("a[href*='content/post_'], a[href*='gd.gov.cn']").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

      // 过滤非文章链接
      if (
        href.includes(".css") ||
        href.includes(".js") ||
        href.includes(".jpg") ||
        href.includes(".png") ||
        href === "#" ||
        href === "/"
      ) {
        return;
      }

      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `http:${href}`
          : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;

      if (seen.has(fullUrl) || !fullUrl.includes(".html")) return;
      seen.add(fullUrl);

      const title = $el.text().trim();
      if (!title || title.length < 4 || title.length > 100) return;

      articles.push({
        title,
        url: fullUrl,
        section: "广东要闻",
      });
    });

    // 抓取前几篇文章的详情页
    const detailed: RawArticle[] = [];
    for (const article of articles.slice(0, 5)) {
      try {
        const detailHtml = await this.fetchWithRetry(article.url);
        const $d = this.parseHtml(detailHtml);

        // 广东省政府网文章正文
        const fullText =
          $d(".article-content").text().trim() ||
          $d(".TRS_Editor").text().trim() ||
          $d(".content").text().trim() ||
          $d("#zoom").text().trim() ||
          $d("article").text().trim();

        // 提取日期
        const dateStr =
          $d(".article-date").text().trim() ||
          $d(".info span").first().text().trim() ||
          $d(".pub-date").text().trim();
        let publishedAt: Date | undefined;
        const dm = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (dm) {
          publishedAt = new Date(
            parseInt(dm[1]),
            parseInt(dm[2]) - 1,
            parseInt(dm[3])
          );
        }

        // 提取来源/作者
        const author =
          $d(".source").text().trim() ||
          $d(".article-source").text().trim() ||
          undefined;

        detailed.push({
          ...article,
          fullText: fullText || undefined,
          excerpt: fullText?.slice(0, 200) || undefined,
          author,
          publishedAt,
        });
      } catch {
        detailed.push(article);
      }
    }

    return detailed.length > 0 ? detailed : articles.slice(0, 5);
  }
}
