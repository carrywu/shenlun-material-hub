import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cheerio from "cheerio";

// Mock dependencies
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    contentItem: { findUnique: vi.fn(), create: vi.fn() },
    collectorRun: { create: vi.fn(), update: vi.fn() },
    collectionChannel: { findMany: vi.fn(), update: vi.fn() },
    source: { update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/services/content-filter", () => ({
  runContentFilters: vi.fn().mockResolvedValue({ filtered: false }),
}));

import { HunanOfficialCollector } from "../web/hunanOfficial";

// ─── 样例 HTML Fixture：湖南文章详情页 ───
const HUNAN_ARTICLE_HTML = `
<!doctype html>
<html>
<head><title>三湘时评文章</title></head>
<body>
<div class="m-head">导航栏</div>
<div class="nav-path">
  <div class="dqwz">
    <a href="/">首页</a>&nbsp;&gt;&nbsp;
    <a href="/hnszf/hnyw/">政务要闻</a>&nbsp;&gt;&nbsp;
    <a href="/hnszf/hnyw/sxsp/">三湘时评</a>
  </div>
</div>
<h1>"哨声"多起来，事故走开去</h1>
<div class="article-info">发布时间： 2026-06-04 07:37</div>
<div class="article-content">
  <p>　　安全生产是民生大事，一丝一毫不能放松。近年来，各地积极探索安全生产治理新模式，其中"吹哨人"制度的推广尤为引人关注。</p>
  <p>　　所谓"吹哨人"制度，就是鼓励企业内部员工发现安全隐患后及时报告，将事故消灭在萌芽状态。这一制度的核心在于"早发现、早报告、早处置"，让每一个员工都成为安全生产的"哨兵"。</p>
  <p>　　从实践来看，"吹哨人"制度已经取得了显著成效。据统计，自推行该制度以来，湖南省安全生产事故发生率明显下降，多个行业领域的安全隐患得到了及时排查和整改。</p>
  <p>　　当然，"吹哨人"制度的推广还面临一些挑战。如何保护举报人的合法权益，如何建立有效的激励机制，如何确保举报信息得到及时处理，这些都是需要进一步完善的问题。</p>
  <p>　　安全生产没有终点，只有起点。让"哨声"多起来，让事故走开去，这是我们共同的期盼，也是我们共同的责任。</p>
  <p>（文/何淼玲）</p>
</div>
<div class="article-source">信息来源： 湖南日报</div>
<div class="footer">备案信息：湘ICP备05000618号</div>
</body>
</html>
`;

// ─── 样例 HTML Fixture：湖南列表页 ───
const HUNAN_LIST_HTML = `
<!doctype html>
<html>
<head><title>三湘时评</title></head>
<body>
<div class="nav-path">
  <div class="dqwz">首页 > 政务要闻 > 三湘时评</div>
</div>
<div class="yl-list">
  <div class="yl-list2">
    <div class="yl-list1">三湘时评（按发稿时间排序）</div>
    <div class="yl-listbox">
      <ul>
        <li><a target="_blank" href='./202606/t20260604_33993282.html' title='"哨声"多起来，事故走开去'><i></i>"哨声"多起来，事故走开去</a><span>2026-06-04</span></li>
        <li><a target="_blank" href='./202606/t20260603_33992100.html' title='以高质量党建引领基层治理'><i></i>以高质量党建引领基层治理</a><span>2026-06-03</span></li>
        <li><a target="_blank" href='./202605/t20260530_33988765.html' title='让群众获得感成色更足'><i></i>让群众获得感成色更足</a><span>2026-05-30</span></li>
      </ul>
    </div>
  </div>
</div>
</body>
</html>
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CollectorAny = any;

describe("湖南省政府网采集器", () => {
  let collector: HunanOfficialCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new HunanOfficialCollector();
  });

  describe("extractArticleDetail", () => {
    it("应该正确提取文章标题、正文、发布时间", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        HUNAN_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_33993282.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("安全生产是民生大事");
      expect(result.fullText).toContain("吹哨人");
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4, 7, 37));
    });

    it("应该提取信息来源（湖南日报）到 author 字段", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        HUNAN_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_33993282.html"
      );

      expect(result).not.toBeNull();
      // 信息来源 + 作者拼接
      expect(result.author).toContain("湖南日报");
      expect(result.author).toContain("文/何淼玲");
    });

    it("正文不应包含页脚、导航、备案信息", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        HUNAN_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_33993282.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).not.toContain("备案信息");
      expect(result.fullText).not.toContain("湘ICP备");
      expect(result.fullText).not.toContain("导航栏");
    });

    it("正文过短时应返回 null", async () => {
      const shortHtml = `
        <html><body>
        <div class="article-content"><p>太短了</p></div>
        </body></html>
      `;
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        shortHtml
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_short.html"
      );

      expect(result).toBeNull();
    });

    it("无 article-content 或 zoom 时应返回 null", async () => {
      const noContentHtml = `<html><body><div class="other">内容</div></body></html>`;
      vi.spyOn(
        collector as CollectorAny,
        "fetchWithRetry"
      ).mockResolvedValue(noContentHtml);

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_nocontent.html"
      );

      expect(result).toBeNull();
    });

    it("仅日期无时间时应正确解析", async () => {
      const html = HUNAN_ARTICLE_HTML.replace(
        "2026-06-04 07:37",
        "2026-06-04"
      );
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        html
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.hunan.gov.cn/test.html"
      );

      expect(result).not.toBeNull();
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4));
    });
  });

  describe("extractLinksFromListPage", () => {
    it("应该从 .yl-listbox 提取文章链接", () => {
      const $ = cheerio.load(HUNAN_LIST_HTML);

      const links = (
        collector as CollectorAny
      ).extractLinksFromListPage(
        $,
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/index.html",
        "t\\d{8}_\\d+\\.html"
      );

      expect(links).toHaveLength(3);
      expect(links[0].title).toBe('"哨声"多起来，事故走开去');
      expect(links[0].url).toContain("t20260604_33993282.html");
      expect(links[1].title).toBe("以高质量党建引领基层治理");
      expect(links[2].title).toBe("让群众获得感成色更足");
    });

    it("应该将相对路径转为绝对 URL", () => {
      const $ = cheerio.load(HUNAN_LIST_HTML);

      const links = (
        collector as CollectorAny
      ).extractLinksFromListPage(
        $,
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/index.html",
        "t\\d{8}_\\d+\\.html"
      );

      expect(links[0].url).toBe(
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/202606/t20260604_33993282.html"
      );
    });

    it("应该过滤重复 URL", () => {
      const html = `
        <div class="yl-listbox"><ul>
          <li><a href='./202606/t20260604_33993282.html' title='第一篇文章标题A'>第一篇文章标题A</a></li>
          <li><a href='./202606/t20260604_33993282.html' title='重复文章标题B'>重复文章标题B</a></li>
          <li><a href='./202606/t20260603_33992100.html' title='第二篇文章标题C'>第二篇文章标题C</a></li>
        </ul></div>
      `;
      const $ = cheerio.load(html);

      const links = (
        collector as CollectorAny
      ).extractLinksFromListPage(
        $,
        "https://www.hunan.gov.cn/hnszf/hnyw/sxsp/index.html",
        "t\\d{8}_\\d+\\.html"
      );

      // 去重后应只有 2 条
      expect(links).toHaveLength(2);
      expect(links[0].title).toBe("第一篇文章标题A");
      expect(links[1].title).toBe("第二篇文章标题C");
    });

    it("应该过滤标题过短的链接", () => {
      const html = `
        <div class="yl-listbox"><ul>
          <li><a href='./202606/t20260604_33993282.html' title='好文章标题'>好文章标题</a></li>
          <li><a href='./202606/t20260603_33992100.html' title='短'>短</a></li>
        </ul></div>
      `;
      const $ = cheerio.load(html);

      const links = (
        collector as CollectorAny
      ).extractLinksFromListPage(
        $,
        "https://www.hunan.gov.cn/test.html",
        "t\\d{8}_\\d+\\.html"
      );

      expect(links).toHaveLength(1);
      expect(links[0].title).toBe("好文章标题");
    });
  });

  describe("collectorType 和 sourceName", () => {
    it("collectorType 应为 hunan_official", () => {
      expect(collector.collectorType).toBe("hunan_official");
    });

    it("sourceName 应为 湖南省政府网", () => {
      expect(collector.sourceName).toBe("湖南省政府网");
    });
  });
});
