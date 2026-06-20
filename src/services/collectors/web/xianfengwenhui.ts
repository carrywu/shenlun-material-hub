import { BaseCollector, type RawArticle } from "../base";
import { extractArticleContent } from "../content-extractor";

const BASE_URL = "https://tougao.12371.cn";
const LIST_URL = `${BASE_URL}/wenhui.php`;

export class XianfengwenhuiCollector extends BaseCollector {
  readonly collectorType = "xianfengwenhui";
  readonly sourceName = "先锋文汇";

  /**
   * 覆盖通用详情页提取，适配 Discuz 论坛结构
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; rawHtml?: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // 用统一提取器：Discuz 帖子正文优先 .t_f / #postmessage_ / .message，
      // 兜底 #postlist / .forum-content；保留 rawHtml + 结构化 fullText。
      const extracted = extractArticleContent(
        $,
        [
          ".t_f",
          "[id^='postmessage_']",
          ".message",
          "#postlist",
          ".forum-content",
        ],
        url
      );
      if (!extracted) return null;
      const { fullText, rawHtml } = extracted;

      // 提取日期
      const dateText =
        $(".authorinfo em").first().text().trim() ||
        $("[id^='postmessage_']")
          .closest(".plc")
          .find(".authorinfo em")
          .text()
          .trim();
      let publishedAt: Date | undefined;
      if (dateText) {
        const match = dateText.match(
          /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/
        );
        if (match) {
          publishedAt = new Date(
            parseInt(match[1]),
            parseInt(match[2]) - 1,
            parseInt(match[3]),
            parseInt(match[4]),
            parseInt(match[5])
          );
        }
      }

      return { fullText, rawHtml, publishedAt };
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
    const listHtml = await this.fetchWithRetry(LIST_URL);
    const $ = this.parseHtml(listHtml);
    const articles: RawArticle[] = [];

    // 先锋文汇使用 Discuz 论坛系统，文章链接含 gaojian.php?tid=
    const links = $("a[href*='gaojian.php?tid=']");
    const seen = new Set<string>();

    links.each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

      const fullUrl = href.startsWith("http")
        ? href
        : `${BASE_URL}/${href.replace(/^\//, "")}`;

      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      const title = $el.text().trim();
      if (!title || title.length < 4) return;

      articles.push({
        title,
        url: fullUrl,
        section: "先锋文汇",
      });
    });

    // 抓取前几篇文章的详情页获取全文
    const detailed: RawArticle[] = [];
    for (const article of articles.slice(0, 10)) {
      const detail = await this.extractArticleDetail(article.url);
      if (!detail) continue;

      detailed.push({
        ...article,
        fullText: detail.fullText,
        rawHtml: detail.rawHtml,
        excerpt: detail.fullText.slice(0, 200),
        publishedAt: detail.publishedAt,
      });
    }

    return detailed;
  }
}
