import { BaseCollector, type RawArticle } from "../base";
import { logger } from "@/lib/logger";
import { extractArticleContent } from "../content-extractor";

// 广东省政府网采集器
// 使用栏目配置（CollectionChannel）进行采集
// 不再默认采集首页，必须配置具体栏目列表页
//
// 详情页结构（已验证 https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html）：
//   标题: 在 .viewList 或 .con 内
//   时间: "时间  :  2026-06-04 10:13:50"
//   来源: "来源  :  广州日报"
//   正文: div.zw
//   面包屑: div.con 内 "首页 > 要闻动态 > 部门动态"

export class GuangdongOfficialCollector extends BaseCollector {
  readonly collectorType = "guangdong_official";
  readonly sourceName = "广东省政府网";

  /**
   * 覆盖通用详情页提取，适配广东省政府网结构
   * 正文容器: div.zw（广东政府网专用）
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; rawHtml?: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // ── 正文提取 ──
      // 用统一提取器：广东政府网正文容器优先 div.zw，保留 rawHtml + 结构化 fullText
      const extracted = extractArticleContent(
        $,
        [".zw", ".article-content", ".TRS_Editor", ".content", "#zoom", "article"],
        url
      );
      if (!extracted) return null;
      const { fullText, rawHtml } = extracted;

      // ── 发布时间 ──
      // 格式: "时间  :  2026-06-04 10:13:50" 或 "2026-06-04"
      // P2-11: scope date extraction to content area + nearby metadata to avoid false matches
      let publishedAt: Date | undefined;
      const contentAreaText = fullText + " " +
        ($(".article-date").text() || $(".pub-date").text() || $(".info").text() || "");

      // 先尝试完整日期时间
      const timeMatch = contentAreaText.match(
        /时间\s*[：:]\s*(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
      );
      if (timeMatch) {
        publishedAt = new Date(
          parseInt(timeMatch[1]),
          parseInt(timeMatch[2]) - 1,
          parseInt(timeMatch[3]),
          parseInt(timeMatch[4]),
          parseInt(timeMatch[5]),
          timeMatch[6] ? parseInt(timeMatch[6]) : 0
        );
      } else {
        // fallback: 仅日期（from content area, not full page）
        const dateMatch = contentAreaText.match(
          /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/
        );
        if (dateMatch) {
          publishedAt = new Date(
            parseInt(dateMatch[1]),
            parseInt(dateMatch[2]) - 1,
            parseInt(dateMatch[3])
          );
        }
      }

      // ── 来源 / 作者 ──
      // 格式: "来源  :  广州日报"
      let author: string | undefined;
      const sourceMatch = contentAreaText.match(
        /来源\s*[：:]\s*([^<\n]+)/
      );
      if (sourceMatch) {
        author = sourceMatch[1].trim();
      } else {
        author =
          $(".source").text().trim() ||
          $(".article-source").text().trim() ||
          undefined;
      }

      return { fullText, rawHtml, publishedAt, author };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error("广东政府采集异常", "CRAWLER", `URL: ${url}, Error: ${message}`);
      return null;
    }
  }

  /**
   * 覆盖通用链接提取，适配广东省政府网链接格式
   * 文章链接含 content/post_ 或 /zwgk/
   */
  protected override extractLinksFromListPage(
    $: ReturnType<typeof import("cheerio").load>,
    listUrl: string,
    _urlPattern: string | null
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
