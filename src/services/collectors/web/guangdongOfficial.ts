import { BaseCollector, type RawArticle } from "../base";

// 广东省政府网采集器
// P0-3: 使用栏目配置（CollectionChannel）进行采集
// 不再默认采集首页，必须配置具体栏目列表页

export class GuangdongOfficialCollector extends BaseCollector {
  readonly collectorType = "guangdong_official";
  readonly sourceName = "广东省政府网";

  /**
   * 覆盖通用详情页提取，适配广东省政府网结构
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      const fullText =
        $(".article-content").text().trim() ||
        $(".TRS_Editor").text().trim() ||
        $(".content").text().trim() ||
        $("#zoom").text().trim() ||
        $("article").text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      const dateStr =
        $(".article-date").text().trim() ||
        $(".info span").first().text().trim() ||
        $(".pub-date").text().trim();
      let publishedAt: Date | undefined;
      const dm = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
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
   * 覆盖通用链接提取，适配广东省政府网链接格式
   */
  protected override extractLinksFromListPage(
    $: ReturnType<typeof import("cheerio").load>,
    listUrl: string,
    urlPattern: string | null
  ): Array<{ title: string; url: string }> {
    const links: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();

    // 广东省政府网文章链接含 content/post_ 或 /zwgk/
    $("a[href*='content/post_'], a[href*='/zwgk/']").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href || href === "#" || href === "/") return;

      // 过滤非文章链接
      if (
        href.includes(".css") ||
        href.includes(".js") ||
        href.includes(".jpg") ||
        href.includes(".png") ||
        href.includes("/index.") ||
        href.includes("/list.")
      ) {
        return;
      }

      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `https:${href}`
          : new URL(href, listUrl).href;

      if (seen.has(fullUrl) || !fullUrl.includes(".html")) return;
      seen.add(fullUrl);

      const title = $el.text().trim();
      if (!title || title.length < 4 || title.length > 100) return;

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
