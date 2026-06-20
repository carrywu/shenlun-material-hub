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

import { XianfengwenhuiCollector } from "../web/xianfengwenhui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CollectorAny = any;

// ─── HTML Fixture：先锋文汇文章详情页（Discuz 结构）───

const XFWH_ARTICLE_HTML = `
<!doctype html>
<html>
<head><title>先锋文汇 - 党建文章</title></head>
<body>
<div id="postlist">
  <div class="plc">
    <div class="authorinfo">
      <em>2026-06-04 14:30</em>
    </div>
    <div class="t_f">　　基层党组织是党执政大厦的地基，地基固则大厦固，地基松则大厦松。加强基层党组织建设，是推进党的建设新的伟大工程的重要基础性工作，对于实现党的执政使命具有十分重大的意义。新时代加强基层党组织建设，要坚持以提升组织力为重点，突出政治功能，把基层党组织建设成为宣传党的主张、贯彻党的决定、领导基层治理、团结动员群众、推动改革发展的坚强战斗堡垒。要健全基层组织，优化组织设置，理顺隶属关系，确保党的组织和工作全覆盖，确保基层党组织真正成为带领群众前进的主心骨。　　要把思想政治建设摆在首位，坚持用党的创新理论武装头脑、指导实践、推动工作，教育引导广大党员增强"四个意识"、坚定"四个自信"、做到"两个维护"。要严格执行新形势下党内政治生活若干准则，增强党内政治生活的政治性、时代性、原则性、战斗性。</div>
    <div id="postmessage_12345" style="display:none">
　　新时代加强基层党组织建设，要坚持以提升组织力为重点，突出政治功能。要健全基层组织，优化组织设置，理顺隶属关系，确保党的组织和工作全覆盖。要推进党的基层组织设置和活动方式创新，加强社会组织党建工作，扩大基层党组织覆盖面。

　　要加强党支部标准化规范化建设，推动党支部担负好直接教育党员、管理党员、监督党员和组织群众、宣传群众、凝聚群众、服务群众的职责。要坚持"三会一课"制度，推进党的基层组织生活制度创新，增强党的组织生活活力。

　　要选优配强基层党组织带头人，着力培养一支数量充足、素质优良、结构合理的基层党组织书记队伍。要加强党员教育管理，做好发展党员工作，严格党的组织生活，保持党员队伍的先进性和纯洁性。

　　要持续整顿软弱涣散基层党组织，着力解决一些基层党组织弱化、虚化、边缘化问题。要加大基层基础保障力度，确保基层党组织有资源、有能力为群众服务。
    </div>
  </div>
</div>
</body>
</html>
`;

// ─── HTML Fixture：使用 [id^='postmessage_'] 选择器 ───

const XFWH_POSTMSG_HTML = `
<!doctype html>
<html>
<head><title>先锋文汇帖子</title></head>
<body>
<div id="postlist">
  <div class="plc">
    <div class="authorinfo">
      <em>2026-05-20 09:15</em>
    </div>
    <div id="postmessage_67890">
      <p>　　新时代党的建设总要求是：坚持和加强党的全面领导，坚持党要管党、全面从严治党，以加强党的长期执政能力建设、先进性和纯洁性建设为主线，以党的政治建设为统领，以坚定理想信念宗旨为根基，以调动全党积极性、主动性、创造性为着力点。</p>
      <p>　　全面推进党的政治建设、思想建设、组织建设、作风建设、纪律建设，把制度建设贯穿其中，深入推进反腐败斗争，不断提高党的建设质量，把党建设成为始终走在时代前列、人民衷心拥护、勇于自我革命、经得起各种风浪考验、朝气蓬勃的马克思主义执政党。</p>
      <p>　　要坚持和加强党的全面领导，完善党的领导方式，增强党的执政本领，提高党的执政能力和领导水平，确保党始终成为中国特色社会主义事业的坚强领导核心。</p>
      <p>　　要以加强党的长期执政能力建设、先进性和纯洁性建设为主线，把党的政治建设摆在首位，思想建党和制度治党同向发力，统筹推进党的各项建设。</p>
    </div>
  </div>
</div>
</body>
</html>
`;

// ─── HTML Fixture：正文过短 ───

const XFWH_SHORT_HTML = `
<html><body>
<div class="t_f">太短了</div>
</body></html>
`;

// ─── HTML Fixture：无正文容器 ───

const XFWH_NO_CONTENT_HTML = `
<html><body>
<div class="other">一些其他内容</div>
</body></html>
`;

// ─── HTML Fixture：列表页 ───

const XFWH_LIST_HTML = `
<!doctype html>
<html>
<head><title>先锋文汇投稿</title></head>
<body>
<div class="list">
  <a href="gaojian.php?tid=12345">基层党组织建设的实践与思考</a>
  <a href="gaojian.php?tid=12346">推进党建高质量发展</a>
  <a href="gaojian.php?tid=12347">创新党员教育管理方式</a>
  <a href="http://other.site.com/page.html">外部链接</a>
  <a href="/about.html">关于我们</a>
  <a href="gaojian.php?tid=12345">重复链接</a>
</div>
</body>
</html>
`;

describe("先锋文汇采集器", () => {
  let collector: XianfengwenhuiCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new XianfengwenhuiCollector();
  });

  describe("extractArticleDetail", () => {
    it("应该正确提取正文和发布时间（.t_f 选择器）", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        XFWH_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=12345"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("基层党组织");
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4, 14, 30));
    });

    it("应保留正文 HTML(rawHtml)，fullText 不残留 HTML 标签", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        XFWH_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=12345"
      );

      expect(result).not.toBeNull();
      // Discuz .t_f 正文可能是裸文本（无 <p>），rawHtml 至少保留容器与正文内容
      expect(result.rawHtml).toBeTruthy();
      expect(result.rawHtml).toContain("基层党组织");
      // fullText 为纯文本，不应残留 HTML 标签
      expect(result.fullText).not.toContain("<p>");
      expect(result.fullText).not.toContain("<br");
      expect(result.fullText).not.toContain("<div");
    });

    it("应该支持 [id^='postmessage_'] 选择器", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        XFWH_POSTMSG_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=67890"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("党的建设总要求");
      expect(result.publishedAt).toEqual(new Date(2026, 4, 20, 9, 15));
    });

    it("正文过短（<300字）时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        XFWH_SHORT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=short"
      );

      expect(result).toBeNull();
    });

    it("无正文容器时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        XFWH_NO_CONTENT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=nocontent"
      );

      expect(result).toBeNull();
    });

    it("fetchWithRetry 抛出异常时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockRejectedValue(
        new Error("HTTP 404")
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://tougao.12371.cn/gaojian.php?tid=error"
      );

      expect(result).toBeNull();
    });
  });

  describe("extractLinksFromListPage (via collect list parsing)", () => {
    it("应该提取 gaojian.php?tid= 链接", () => {
      const $ = cheerio.load(XFWH_LIST_HTML);

      // Simulate what collect() does with the list HTML
      const links: Array<{ title: string; url: string }> = [];
      const seen = new Set<string>();

      $("a[href*='gaojian.php?tid=']").each((_i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        if (!href) return;

        const fullUrl = href.startsWith("http")
          ? href
          : `https://tougao.12371.cn/${href.replace(/^\//, "")}`;

        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title = $el.text().trim();
        if (!title || title.length < 4) return;

        links.push({ title, url: fullUrl });
      });

      expect(links).toHaveLength(3);
      expect(links[0].title).toBe("基层党组织建设的实践与思考");
      expect(links[0].url).toContain("tid=12345");
      expect(links[1].title).toBe("推进党建高质量发展");
      expect(links[2].title).toBe("创新党员教育管理方式");
    });

    it("应该过滤重复 URL", () => {
      const $ = cheerio.load(XFWH_LIST_HTML);

      const links: Array<{ title: string; url: string }> = [];
      const seen = new Set<string>();

      $("a[href*='gaojian.php?tid=']").each((_i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        if (!href) return;

        const fullUrl = href.startsWith("http")
          ? href
          : `https://tougao.12371.cn/${href.replace(/^\//, "")}`;

        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title = $el.text().trim();
        if (!title || title.length < 4) return;

        links.push({ title, url: fullUrl });
      });

      // tid=12345 appears twice, but should only be added once
      const tid12345Count = links.filter((l) =>
        l.url.includes("tid=12345")
      ).length;
      expect(tid12345Count).toBe(1);
    });

    it("应该过滤标题过短（<4字）的链接", () => {
      const html = `
        <div>
          <a href="gaojian.php?tid=111">好文章标题</a>
          <a href="gaojian.php?tid=222">短</a>
        </div>
      `;
      const $ = cheerio.load(html);

      const links: Array<{ title: string; url: string }> = [];
      const seen = new Set<string>();

      $("a[href*='gaojian.php?tid=']").each((_i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        if (!href) return;

        const fullUrl = `https://tougao.12371.cn/${href}`;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title = $el.text().trim();
        if (!title || title.length < 4) return;

        links.push({ title, url: fullUrl });
      });

      expect(links).toHaveLength(1);
      expect(links[0].title).toBe("好文章标题");
    });
  });

  describe("collectorType 和 sourceName", () => {
    it("collectorType 应为 xianfengwenhui", () => {
      expect(collector.collectorType).toBe("xianfengwenhui");
    });

    it("sourceName 应为 先锋文汇", () => {
      expect(collector.sourceName).toBe("先锋文汇");
    });
  });
});
