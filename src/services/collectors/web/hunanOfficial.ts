import { BaseCollector, type RawArticle } from "../base";

const BASE_URL = "http://www.hunan.gov.cn";

export class HunanOfficialCollector extends BaseCollector {
  readonly collectorType = "hunan_official";
  readonly sourceName = "湖南省政府网";

  async collect(source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<RawArticle[]> {
    // 湖南省政府网站 - 湖南要闻
    const listHtml = await this.fetchWithRetry(BASE_URL);
    const $ = this.parseHtml(listHtml);
    const articles: RawArticle[] = [];
    const seen = new Set<string>();

    // 湖南省政府网文章链接含 /hnszf/ 路径和 tYYYYMMDD_ 格式
    $("a[href*='/hnszf/']").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

      // 匹配文章链接模式
      if (!href.match(/t\d{8}_\d+\.html/)) return;

      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `http:${href}`
          : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;

      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      const title =
        $el.attr("title")?.trim() || $el.text().trim();
      if (!title || title.length < 4) return;

      // 从 URL 提取栏目
      const sectionMatch = href.match(
        /\/hnszf\/(\w+)\/(\w+)\//
      );
      const section = sectionMatch
        ? `${sectionMatch[1]}/${sectionMatch[2]}`
        : "湖南要闻";

      articles.push({
        title,
        url: fullUrl,
        section,
      });
    });

    // 抓取前几篇文章的详情页
    const detailed: RawArticle[] = [];
    for (const article of articles.slice(0, 5)) {
      try {
        const detailHtml = await this.fetchWithRetry(article.url);
        const $d = this.parseHtml(detailHtml);

        // 湖南省政府网文章正文
        const fullText =
          $d("#zoom").text().trim() ||
          $d(".article-content").text().trim() ||
          $d(".TRS_Editor").text().trim() ||
          $d(".content").text().trim() ||
          $d("article").text().trim();

        // 提取日期
        const dateStr =
          $d(".article-date").text().trim() ||
          $d(".info span").first().text().trim() ||
          $d(".pub-date").text().trim();
        let publishedAt: Date | undefined;
        const dm = dateStr.match(
          /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/
        );
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
