import { BaseCollector, type RawArticle } from "../base";

const BASE_URL = "http://paper.people.com.cn";
const TODAY_URL = `${BASE_URL}/rmrb/html`;

export class PeoplesDailyCollector extends BaseCollector {
  readonly collectorType = "peoples_daily";
  readonly sourceName = "人民日报";

  async collect(source: {
    id: string;
    platform: string;
    contentType: string;
    trustLevel: string;
    baseUrl?: string | null;
  }): Promise<RawArticle[]> {
    // 人民日报数字报按日期组织: /rmrb/html/YYYY-MM/DD/
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateUrl = `${TODAY_URL}/${year}-${month}/${day}/`;

    let listHtml: string;
    try {
      listHtml = await this.fetchWithRetry(dateUrl);
    } catch {
      // 当天可能还没更新，尝试前一天
      const yesterday = new Date(now.getTime() - 86400000);
      const ym = String(yesterday.getMonth() + 1).padStart(2, "0");
      const yd = String(yesterday.getDate()).padStart(2, "0");
      listHtml = await this.fetchWithRetry(
        `${TODAY_URL}/${year}-${ym}/${yd}/`
      );
    }

    const $ = this.parseHtml(listHtml);
    const articles: RawArticle[] = [];

    // 人民日报数字报版面链接格式: nbs.D110000renmrb_01.htm
    const pageLinks = $("a[href*='D110000renmrb']");
    const seen = new Set<string>();

    pageLinks.each((_i, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) return;

      // 提取版面链接
      const match = href.match(/nbs\.(D110000renmrb_\d+)\.htm/);
      if (!match) return;

      const pageUrl = href.startsWith("http")
        ? href
        : `${dateUrl}${href}`;

      if (seen.has(pageUrl)) return;
      seen.add(pageUrl);

      const title = $el.text().trim() || `人民日报${match[1].slice(-2)}版`;

      articles.push({
        title,
        url: pageUrl,
        section: `第${match[1].slice(-2)}版`,
      });
    });

    // 抓取前几个版面的文章
    const detailed: RawArticle[] = [];
    for (const page of articles.slice(0, 3)) {
      try {
        const pageHtml = await this.fetchWithRetry(page.url);
        const $p = this.parseHtml(pageHtml);

        // 版面文章链接
        $p("a[href*='.htm']").each((_j, a) => {
          const $a = $p(a);
          const artHref = $a.attr("href");
          if (!artHref || artHref.includes("nbs.")) return;

          const artTitle = $a.text().trim();
          if (!artTitle || artTitle.length < 4) return;

          const artUrl = artHref.startsWith("http")
            ? artHref
            : `${page.url.replace(/[^/]+$/, "")}${artHref}`;

          if (seen.has(artUrl)) return;
          seen.add(artUrl);

          detailed.push({
            title: artTitle,
            url: artUrl,
            section: page.section,
          });
        });
      } catch {
        // 版面抓取失败，跳过
      }
    }

    // 抓取前几篇文章的全文
    const result: RawArticle[] = [];
    for (const art of detailed.slice(0, 5)) {
      try {
        const artHtml = await this.fetchWithRetry(art.url);
        const $a = this.parseHtml(artHtml);

        // 人民日报文章正文通常在 .ozmwen 或 #ozoom 中
        const fullText =
          $a(".ozmwen").text().trim() ||
          $a("#ozoom").text().trim() ||
          $a(".text_con").text().trim() ||
          $a("td.news_content").text().trim();

        // 提取日期
        const dateStr =
          $a(".fl").text().trim() ||
          $a(".date").text().trim();
        let publishedAt: Date | undefined;
        const dm = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (dm) {
          publishedAt = new Date(
            parseInt(dm[1]),
            parseInt(dm[2]) - 1,
            parseInt(dm[3])
          );
        }

        result.push({
          ...art,
          fullText: fullText || undefined,
          excerpt: fullText?.slice(0, 200) || undefined,
          publishedAt,
        });
      } catch {
        result.push(art);
      }
    }

    return result.length > 0 ? result : detailed.slice(0, 5);
  }
}
