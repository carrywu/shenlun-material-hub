import { BaseCollector, type RawArticle } from "../base";

const BASE_URL = "http://opinion.people.com.cn";

export class PeopleOpinionCollector extends BaseCollector {
  readonly collectorType = "people_opinion";
  readonly sourceName = "人民网观点";

  /**
   * 覆盖通用详情页提取，适配人民网结构
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // 人民网文章正文通常在 .rm_txt_con 或 #rwb_zw 中
      const fullText =
        $(".rm_txt_con").text().trim() ||
        $("#rwb_zw").text().trim() ||
        $(".text_con").text().trim() ||
        $(".article_content").text().trim() ||
        $("div[class*='content']").first().text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      // 提取作者
      const author =
        $(".author").text().trim() ||
        $(".rm_txt_con .fl a").first().text().trim() ||
        undefined;

      // 提取日期
      const dateStr =
        $(".fl").text().trim() ||
        $(".date").text().trim() ||
        $("div[class*='source']").text().trim();
      let publishedAt: Date | undefined;
      const dm = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dm) {
        publishedAt = new Date(
          parseInt(dm[1]),
          parseInt(dm[2]) - 1,
          parseInt(dm[3])
        );
      }

      return { fullText, publishedAt, author };
    } catch {
      return null;
    }
  }

  async collect(_source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<RawArticle[]> {
    // 人民网观点频道
    const listUrl = `${BASE_URL}/GB/8213/49160/index.html`;
    let listHtml: string;

    try {
      listHtml = await this.fetchWithRetry(listUrl);
    } catch {
      // 降级到观点频道首页
      listHtml = await this.fetchWithRetry(`${BASE_URL}/`);
    }

    const $ = this.parseHtml(listHtml);
    const articles: RawArticle[] = [];
    const seen = new Set<string>();

    // 人民网观点频道文章链接模式
    $("a[href]").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

      // 匹配文章链接模式
      if (
        !href.match(/\/\d{4}\/\d{4}\/C\d+-\d+\.html/) &&
        !href.match(/\/n1\/\d{4}\/\d{4}\/c\d+-\d+\.html/) &&
        !href.match(/\/n1\/\d{4}\/\d{4}\/\w+\/\d+\.html/)
      ) {
        return;
      }

      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `http:${href}`
          : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;

      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      const title = $el.text().trim();
      if (!title || title.length < 4 || title.length > 100) return;

      articles.push({
        title,
        url: fullUrl,
        section: "观点",
      });
    });

    // 抓取前几篇文章的详情页
    const detailed: RawArticle[] = [];
    for (const article of articles.slice(0, 10)) {
      const detail = await this.extractArticleDetail(article.url);
      if (!detail) continue;

      detailed.push({
        ...article,
        fullText: detail.fullText,
        excerpt: detail.fullText.slice(0, 200),
        author: detail.author,
        publishedAt: detail.publishedAt,
      });
    }

    return detailed;
  }
}
