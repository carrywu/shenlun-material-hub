import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { runContentFilters } from "@/services/content-filter";
import { parseRssUrl } from "@/lib/rss";

export interface RawArticle {
  title: string;
  url: string;
  excerpt?: string;
  fullText?: string;
  author?: string;
  publishedAt?: Date;
  section?: string;
}

export interface CollectorResult {
  sourceId: string;
  collectorType: string;
  discoveredCount: number;
  importedCount: number;
  errors: string[];
}

export interface ChannelConfig {
  id: string;
  name: string;
  listUrl: string;
  urlPattern: string | null;
  paginationPattern: string | null;
  maxPages: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export abstract class BaseCollector {
  abstract readonly collectorType: string;
  abstract readonly sourceName: string;

  protected async fetchWithRetry(
    url: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: DEFAULT_HEADERS,
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(r, delayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url}`);
  }

  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  protected computeContentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  /**
   * 从列表页 HTML 中提取文章链接
   * 子类可覆盖此方法以自定义链接提取逻辑
   */
  protected extractLinksFromListPage(
    $: cheerio.CheerioAPI,
    listUrl: string,
    urlPattern: string | null
  ): Array<{ title: string; url: string }> {
    const links: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();

    $("a[href]").each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href || href === "#" || href === "/") return;

      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `https:${href}`
          : new URL(href, listUrl).href;

      if (seen.has(fullUrl)) return;

      // 如果有 URL 模式过滤
      if (urlPattern) {
        const regex = new RegExp(urlPattern);
        if (!regex.test(fullUrl) && !regex.test(href)) return;
      }

      seen.add(fullUrl);

      const title = $el.text().trim();
      if (!title || title.length < 4 || title.length > 100) return;

      links.push({ title, url: fullUrl });
    });

    return links;
  }

  /**
   * 从文章详情页提取全文
   * 子类可覆盖此方法以适配特定网站结构
   */
  protected async extractArticleDetail(
    url: string
  ): Promise<{ fullText: string; publishedAt?: Date; author?: string } | null> {
    try {
      const html = await this.fetchWithRetry(url);
      const $ = this.parseHtml(html);

      // 通用正文提取选择器（按优先级）
      const fullText =
        $(".article-content").text().trim() ||
        $(".TRS_Editor").text().trim() ||
        $(".content").text().trim() ||
        $("#zoom").text().trim() ||
        $("article").text().trim() ||
        $(".rm_txt_con").text().trim() ||
        $("#rwb_zw").text().trim() ||
        $(".text_con").text().trim() ||
        $(".t_f").first().text().trim() ||
        $("[id^='postmessage_']").first().text().trim();

      if (!fullText || fullText.length < 300) {
        return null;
      }

      // 提取日期
      const dateStr =
        $(".article-date").text().trim() ||
        $(".info span").first().text().trim() ||
        $(".pub-date").text().trim() ||
        $(".fl").text().trim() ||
        $(".date").text().trim();

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

      // 提取作者
      const author =
        $(".source").text().trim() ||
        $(".article-source").text().trim() ||
        $(".author").text().trim() ||
        undefined;

      return { fullText, publishedAt, author };
    } catch {
      return null;
    }
  }

  /**
   * P0-3: 基于栏目配置的采集方法
   * 子类可覆盖以实现栏目特定的采集逻辑
   */
  async collectFromChannel(
    channel: ChannelConfig,
    _source: { id: string; platform: string; contentType: string; trustLevel: string }
  ): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= channel.maxPages; page++) {
      let listUrl = channel.listUrl;
      
      // RSS 支持：如果 URL 以 xml 结尾或明确标记为 rss，且只在第一页抓取
      if ((listUrl.endsWith('.xml') || channel.urlPattern === 'rss')) {
        if (page > 1) break; // RSS 通常没有标准的分页参数结构，这里只抓取第一页
        try {
          const feed = await parseRssUrl(listUrl);
          for (const item of feed.items) {
            const url = item.link || item.guid || "";
            if (!url || seen.has(url)) continue;
            seen.add(url);
            
            const fullText = item["content:encoded"] || item.content || item.contentSnippet || "";
            const title = item.title || "无标题";
            const publishedAt = item.pubDate ? new Date(item.pubDate) : undefined;
            const author = item.creator;
            
            articles.push({
              title,
              url,
              fullText,
              excerpt: fullText.slice(0, 200),
              author,
              publishedAt,
              section: channel.name,
            });
          }
        } catch (error) {
           console.error(`RSS 采集失败 [${listUrl}]:`, error);
           throw error; // 向上抛出以记录到 collectorRun
        }
        continue;
      }

      // 处理 HTML 分页 URL
      if (page > 1 && channel.paginationPattern) {
        listUrl = channel.paginationPattern.replace("{page}", String(page));
      } else if (page > 1) {
        // 尝试常见的分页 URL 模式
        const urlObj = new URL(channel.listUrl);
        const basePath = urlObj.pathname.replace(/\/index\.html?$/, "");
        listUrl = `${urlObj.origin}${basePath}/index_${page}.html`;
      }

      let listHtml: string;
      try {
        listHtml = await this.fetchWithRetry(listUrl);
      } catch {
        // 分页不存在或获取失败，停止翻页
        break;
      }

      const $ = this.parseHtml(listHtml);
      const links = this.extractLinksFromListPage($, listUrl, channel.urlPattern);

      for (const link of links) {
        if (seen.has(link.url)) continue;
        seen.add(link.url);

        const detail = await this.extractArticleDetail(link.url);
        if (!detail) continue;

        articles.push({
          title: link.title,
          url: link.url,
          fullText: detail.fullText,
          excerpt: detail.fullText.slice(0, 200),
          author: detail.author,
          publishedAt: detail.publishedAt,
          section: channel.name,
        });
      }
    }

    return articles;
  }

  /**
   * 旧版采集方法（兼容）
   */
  abstract collect(
    source: { id: string; platform: string; contentType: string; trustLevel: string; baseUrl?: string | null }
  ): Promise<RawArticle[]>;

  protected async normalizeToContentItem(
    raw: RawArticle,
    source: { id: string; platform: string; contentType: string; trustLevel: string },
    channelId?: string
  ): Promise<{
    created: boolean;
    item: { id: string; title: string; originalUrl: string };
    filtered?: boolean;
    filterReason?: string;
  }> {
    const existing = await db.contentItem.findUnique({
      where: { originalUrl: raw.url },
    });

    if (existing) {
      return { created: false, item: existing };
    }

    const fullText = raw.fullText ?? null;
    const excerpt = raw.excerpt ?? fullText?.slice(0, 200) ?? null;
    const contentHash = fullText ? this.computeContentHash(fullText) : null;
    const effectiveTextLength = fullText
      ? fullText.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim().length
      : 0;

    // P0-5 质量门控：无全文或全文过短（<300字）直接标记为 filtered
    if (!fullText || effectiveTextLength < 300) {
      const reason = !fullText
        ? "无全文内容（采集器未获取到正文）"
        : `全文过短（${effectiveTextLength} 字），不足 300 字`;

      const item = await db.contentItem.create({
        data: {
          sourceId: source.id,
          channelId: channelId ?? null,
          title: raw.title,
          originalUrl: raw.url,
          platform: source.platform,
          contentType: source.contentType,
          trustLevel: source.trustLevel,
          authorOrAccount: raw.author ?? null,
          publishedAt: raw.publishedAt ?? null,
          section: raw.section ?? null,
          excerpt,
          fullText,
          fullTextStored: !!fullText,
          contentHash,
          processingStatus: "filtered",
          filterReason: reason,
          qualityStatus: "filtered",
          effectiveTextLength,
          regionScopes: "[]",
          topicTags: "[]",
          discoveryChannel: "web_collector",
        },
      });

      return { created: true, item, filtered: true, filterReason: reason };
    }

    // Run content filters before creating
    const filterResult = await runContentFilters(
      raw.url,
      raw.title,
      fullText,
      excerpt,
      contentHash
    );

    const item = await db.contentItem.create({
      data: {
        sourceId: source.id,
        channelId: channelId ?? null,
        title: raw.title,
        originalUrl: raw.url,
        platform: source.platform,
        contentType: source.contentType,
        trustLevel: source.trustLevel,
        authorOrAccount: raw.author ?? null,
        publishedAt: raw.publishedAt ?? null,
        section: raw.section ?? null,
        excerpt,
        fullText,
        fullTextStored: !!fullText,
        contentHash,
        processingStatus: filterResult.filtered
          ? "filtered"
          : "pending",
        filterReason: filterResult.reason ?? null,
        qualityStatus: filterResult.filtered ? "filtered" : "candidate",
        effectiveTextLength,
        regionScopes: "[]",
        topicTags: "[]",
        discoveryChannel: "web_collector",
      },
    });

    return {
      created: true,
      item,
      filtered: filterResult.filtered,
      filterReason: filterResult.reason,
    };
  }

  /**
   * 执行采集（支持栏目配置）
   * 优先使用栏目配置，无栏目时使用旧版 collect()
   */
  async run(source: {
    id: string;
    name: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<CollectorResult> {
    const errors: string[] = [];
    let discoveredCount = 0;
    let importedCount = 0;

    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: this.collectorType,
        status: "running",
      },
    });

    try {
      // 查询该来源的栏目配置
      const channels = await db.collectionChannel.findMany({
        where: { sourceId: source.id, isEnabled: true },
      });

      let articles: RawArticle[] = [];
      // P1-7 fix: track which channel each article came from
      const articleChannelMap = new Map<string, string>(); // article url -> channelId

      if (channels.length > 0) {
        // 使用栏目配置采集
        for (const channel of channels) {
          try {
            const channelArticles = await this.collectFromChannel(
              {
                id: channel.id,
                name: channel.name,
                listUrl: channel.listUrl,
                urlPattern: channel.urlPattern,
                paginationPattern: channel.paginationPattern,
                maxPages: channel.maxPages,
              },
              source
            );
            for (const art of channelArticles) {
              articles.push(art);
              articleChannelMap.set(art.url, channel.id);
            }

            // 更新栏目采集时间
            await db.collectionChannel.update({
              where: { id: channel.id },
              data: {
                lastCollectedAt: new Date(),
                collectedCount: { increment: channelArticles.length },
              },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            errors.push(`[栏目: ${channel.name}] ${msg}`);
          }
        }
      } else {
        // 无栏目配置，使用旧版 collect()
        articles = await this.collect(source);
      }

      discoveredCount = articles.length;

      for (const article of articles) {
        try {
          // P1-7 fix: use the correct channel for each article
          const channelId = articleChannelMap.get(article.url) ?? (channels.length > 0 ? channels[0].id : undefined);
          const { created } = await this.normalizeToContentItem(article, source, channelId);
          if (created) importedCount++;
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);
          errors.push(`[${article.title}] ${msg}`);
        }
      }

      await db.collectorRun.update({
        where: { id: runRecord.id },
        data: {
          status: errors.length > 0 ? "partial" : "success",
          finishedAt: new Date(),
          discoveredCount,
          importedCount,
          errorSummary: errors.length > 0 ? errors.join("\n") : null,
        },
      });

      await db.source.update({
        where: { id: source.id },
        data: { lastCollectedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);

      await db.collectorRun.update({
        where: { id: runRecord.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          discoveredCount,
          importedCount,
          errorSummary: errorMsg,
        },
      });

      await db.source.update({
        where: { id: source.id },
        data: { lastError: errorMsg },
      });
    }

    return {
      sourceId: source.id,
      collectorType: this.collectorType,
      discoveredCount,
      importedCount,
      errors,
    };
  }
}
