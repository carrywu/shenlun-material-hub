import { BaseCollector, type RawArticle } from "../base";
import { logger } from "@/lib/logger";

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
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // ── 正文提取 ──
      // 广东省政府网使用 div.zw 作为正文容器
      const contentEl =
        $(".zw").length > 0
          ? $(".zw")
          : $(".article-content").length > 0
            ? $(".article-content")
            : $(".TRS_Editor").length > 0
              ? $(".TRS_Editor")
              : $(".content").length > 0
                ? $(".content")
                : $("#zoom").length > 0
                  ? $("#zoom")
                  : $("article").length > 0
                    ? $("article")
                    : null;

      if (!contentEl) return null;

      // 移除非正文元素
      contentEl
        .find("script, style, .footer, .nav-path, .m-head, .m-menu, .search")
        .remove();

      const fullText = contentEl.text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      // ── 发布时间 ──
      // 格式: "时间  :  2026-06-04 10:13:50" 或 "2026-06-04"
      let publishedAt: Date | undefined;
      const fullPageText = $.html();

      // 先尝试完整日期时间
      const timeMatch = fullPageText.match(
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
        // fallback: 仅日期
        const dateMatch = fullPageText.match(
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
      const sourceMatch = fullPageText.match(
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

      return { fullText, publishedAt, author };
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
