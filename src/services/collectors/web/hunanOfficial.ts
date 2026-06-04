import { BaseCollector, type RawArticle } from "../base";

// 湖南省政府网采集器
// P0-3: 使用栏目配置（CollectionChannel）进行采集
// 不再默认采集首页，必须配置具体栏目列表页
//
// 详情页结构（已验证 https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_33993282.html）：
//   标题: h1
//   面包屑: .nav-path .dqwz → "首页 > 政务要闻 > 三湘时评"
//   发布时间: 正文中 "发布时间： YYYY-MM-DD HH:mm"
//   信息来源: 正文末 "信息来源： 湖南日报"
//   作者: 正文末 "（文/何淼玲）"
//   正文: .article-content 或 #zoom 内的 <p> 段落
//   页脚: .footer

export class HunanOfficialCollector extends BaseCollector {
  readonly collectorType = "hunan_official";
  readonly sourceName = "湖南省政府网";

  /**
   * 湖南省政府网 HTTPS 与 Node.js OpenSSL 不兼容（ERR_SSL_BAD_ECPOINT），
   * 需要将 https:// 降级为 http://
   */
  private toHttpUrl(url: string): string {
    return url.replace(/^https:\/\//, "http://");
  }

  /**
   * 覆盖 fetchWithRetry，自动降级 HTTPS → HTTP
   */
  protected override async fetchWithRetry(
    url: string,
    maxRetries?: number,
    delayMs?: number
  ): Promise<string> {
    try {
      return await super.fetchWithRetry(this.toHttpUrl(url), maxRetries, delayMs);
    } catch {
      // 如果 http 也失败，尝试原始 url（https）
      return await super.fetchWithRetry(url, maxRetries, delayMs);
    }
  }

  /**
   * 覆盖通用详情页提取，适配湖南省政府网结构
   * 增强：提取信息来源、支持 HH:mm 时间格式、清洗正文
   */
  protected override async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // ── 正文提取 ──
      // 优先使用 .article-content 或 #zoom，排除页头页尾
      const contentEl =
        $(".article-content").length > 0
          ? $(".article-content")
          : $("#zoom").length > 0
            ? $("#zoom")
            : $(".TRS_Editor").length > 0
              ? $(".TRS_Editor")
              : null;

      if (!contentEl) return null;

      // 移除非正文元素
      contentEl
        .find(".footer, .nav-path, .m-head, .m-menu, script, style, .search")
        .remove();

      const fullText = contentEl.text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      // ── 发布时间 ──
      // 格式: "发布时间： 2026-06-04 07:37" 或 "2026-06-04 07:37"
      let publishedAt: Date | undefined;
      const fullPageText = $.html();
      const timeMatch = fullPageText.match(
        /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})\s+(\d{1,2}):(\d{2})/
      );
      if (timeMatch) {
        publishedAt = new Date(
          parseInt(timeMatch[1]),
          parseInt(timeMatch[2]) - 1,
          parseInt(timeMatch[3]),
          parseInt(timeMatch[4]),
          parseInt(timeMatch[5])
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

      // ── 信息来源 ──
      // "信息来源： 湖南日报"
      let source: string | undefined;
      const sourceMatch = fullPageText.match(
        /信息来源[：:]\s*([^<\n]+)/
      );
      if (sourceMatch) {
        source = sourceMatch[1].trim();
      }

      // ── 作者 / 信息来源 ──
      // 优先提取"信息来源"（如"湖南日报"），这是最有价值的元数据
      // "（文/何淼玲）" 格式的作者信息也一并提取
      let author: string | undefined;

      // 先尝试提取"文/XXX"格式
      const authorMatch = fullText.match(/[（(]?\s*文\/([^)）]+)[)）]?/);
      if (authorMatch) {
        author = `文/${authorMatch[1].trim()}`;
      }

      // 信息来源作为主要 author 字段（如"湖南日报"）
      // 如果有文/作者，拼接为 "湖南日报 | 文/何淼玲"
      if (source && author) {
        author = `${source} | ${author}`;
      } else if (source) {
        author = source;
      } else {
        // fallback: 通用选择器
        author =
          author ||
          $(".source").text().trim() ||
          $(".article-source").text().trim() ||
          undefined;
      }

      return { fullText, publishedAt, author };
    } catch {
      return null;
    }
  }

  /**
   * 覆盖通用链接提取，适配湖南省政府网链接格式
   * 列表页结构：.yl-listbox ul li a[href][title] + span(日期)
   */
  protected override extractLinksFromListPage(
    $: ReturnType<typeof import("cheerio").load>,
    listUrl: string,
    _urlPattern: string | null
  ): Array<{ title: string; url: string }> {
    const links: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();

    // 优先从 .yl-listbox 提取（三湘时评等栏目列表页）
    const listItems = $(".yl-listbox li a");
    if (listItems.length > 0) {
      listItems.each((_i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        if (!href || href === "#" || href === "/") return;

        // 匹配文章链接模式 tYYYYMMDD_NNNNNNNN.html
        if (!href.match(/t\d{8}_\d+\.html/)) return;

        const fullUrl = href.startsWith("http")
          ? href
          : href.startsWith("//")
            ? `https:${href}`
            : new URL(href, listUrl).href;

        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title = $el.attr("title")?.trim() || $el.text().trim();
        if (!title || title.length < 4) return;

        links.push({ title, url: fullUrl });
      });
      return links;
    }

    // fallback: 通用 /hnszf/ 链接提取
    $("a[href*='/hnszf/']").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

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
