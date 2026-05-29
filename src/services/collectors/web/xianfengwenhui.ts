import { BaseCollector, type RawArticle } from "../base";

const BASE_URL = "https://tougao.12371.cn";
const LIST_URL = `${BASE_URL}/wenhui.php`;

export class XianfengwenhuiCollector extends BaseCollector {
  readonly collectorType = "xianfengwenhui";
  readonly sourceName = "先锋文汇";

  async collect(source: {
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
    for (const article of articles.slice(0, 5)) {
      try {
        const detailHtml = await this.fetchWithRetry(article.url);
        const $d = this.parseHtml(detailHtml);

        // Discuz 帖子正文通常在 .t_f 或 #postmessage_ 开头的元素中
        let fullText =
          $d(".t_f").first().text().trim() ||
          $d("[id^='postmessage_']").first().text().trim() ||
          $d(".message").first().text().trim();

        if (!fullText) {
          // 降级：取主内容区文本
          fullText =
            $d("#postlist").text().trim() ||
            $d(".forum-content").text().trim();
        }

        // 提取日期
        const dateText =
          $d(".authorinfo em").first().text().trim() ||
          $d("[id^='postmessage_']")
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

        detailed.push({
          ...article,
          fullText: fullText || undefined,
          excerpt: fullText?.slice(0, 200) || undefined,
          publishedAt,
        });
      } catch {
        // 详情页抓取失败，用列表页信息
        detailed.push(article);
      }
    }

    return detailed.length > 0 ? detailed : articles.slice(0, 5);
  }
}
