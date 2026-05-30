import { BaseCollector, type RawArticle } from "../base";

// 湖南省政府网采集器
// P0-3: 使用栏目配置（CollectionChannel）进行采集
// 不再默认采集首页，必须配置具体栏目列表页

export class HunanOfficialCollector extends BaseCollector {
  readonly collectorType = "hunan_official";
  readonly sourceName = "湖南省政府网";

  /**
   * 覆盖通用详情页提取，适配湖南省政府网结构
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      const fullText =
        $("#zoom").text().trim() ||
        $(".article-content").text().trim() ||
        $(".TRS_Editor").text().trim() ||
        $(".content").text().trim() ||
        $("article").text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      const dateStr =
        $(".article-date").text().trim() ||
        $(".info span").first().text().trim() ||
        $(".pub-date").text().trim();
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

      const author =
        $(".source").text().trim() ||
        $(".article-source").text().trim() ||
        undefined;

      return { fullText, publishedAt, author };
    } catch {
      return null;
    }
  }

  /**
   * 覆盖通用链接提取，适配湖南省政府网链接格式
   */
  protected override extractLinksFromListPage(
    $: ReturnType<typeof import("cheerio").load>,
    listUrl: string,
    urlPattern: string | null
  ): Array<{ title: string; url: string }> {
    const links: Array<{ title: string; url: string }> = [];
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
          ? `https:${href}`
          : new URL(href, listUrl).href;

      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      const title =
        $el.attr("title")?.trim() || $el.text().trim();
      if (!title || title.length < 4) return;

      links.push({ title, url: fullUrl });
    });

    return links;
  }

  /**
   * 旧版采集方法 — 不再使用，保留兼容
   * 实际采集通过 collectFromChannel() 进行
   */
  async collect(): Promise<RawArticle[]> {
    return [];
  }
}
