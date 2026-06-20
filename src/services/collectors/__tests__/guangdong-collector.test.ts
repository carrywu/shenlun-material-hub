import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { GuangdongOfficialCollector } from "../web/guangdongOfficial";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CollectorAny = any;

// ─── HTML Fixture：广东政府网文章详情页 ───

const GD_ARTICLE_HTML = `
<!doctype html>
<html>
<head><title>广东省政府网文章</title></head>
<body>
<div class="m-head">导航栏</div>
<div class="con">
  <div class="nav-path">首页 > 要闻动态 > 部门动态</div>
  <h1>推动高质量发展取得新成效</h1>
  <div class="article-date">时间  :  2026-06-04 10:13:50</div>
  <div class="zw">
    <p>　　高质量发展是全面建设社会主义现代化国家的首要任务。近年来，广东省紧紧围绕高质量发展这一主题，深入推进供给侧结构性改革，加快构建现代化产业体系，推动经济实现质的有效提升和量的合理增长。</p>
    <p>　　在科技创新方面，广东省持续加大研发投入，建设了一批具有国际影响力的科技创新平台。大湾区国际科技创新中心建设稳步推进，一批关键核心技术取得重大突破，为高质量发展提供了强有力的科技支撑。</p>
    <p>　　在产业发展方面，广东省坚持制造业当家，推动传统产业转型升级，大力发展战略性新兴产业和未来产业。新能源汽车、集成电路、人工智能等领域形成了较为完整的产业链，为经济高质量发展注入了新动能。</p>
    <p>　　在营商环境方面，广东省深入推进"放管服"改革，持续优化营商环境，市场主体活力不断增强。一系列惠企政策的出台和落实，有效降低了企业成本，提升了企业获得感。</p>
    <p>　　下一步，广东省将继续坚持高质量发展不动摇，以更大力度推进改革创新，以更高标准优化营商环境，以更实举措增进民生福祉，奋力在推进中国式现代化建设中走在前列。</p>
    <p>来源  :  广州日报</p>
  </div>
</div>
<div class="footer">版权所有：广东省人民政府</div>
</body>
</html>
`;

// ─── HTML Fixture：广东政府网列表页 ───

const GD_LIST_HTML = `
<!doctype html>
<html>
<head><title>广东省政府网-部门动态</title></head>
<body>
<div class="list-box">
  <ul>
    <li><a href="/gdywdt/bmdt/content/post_4906500.html">推动高质量发展取得新成效</a><span>2026-06-04</span></li>
    <li><a href="/gdywdt/bmdt/content/post_4906501.html">深化改革开放推动经济社会发展</a><span>2026-06-03</span></li>
    <li><a href="/zwgk/zfgb/content/post_1234567.html">广东省人民政府公报第10期</a><span>2026-06-02</span></li>
    <li><a href="/index.html">首页</a></li>
    <li><a href="/list.html">列表</a></li>
    <li><a href="/style.css"></a></li>
    <li><a href="/images/banner.png"></a></li>
  </ul>
</div>
</body>
</html>
`;

// ─── HTML Fixture：正文过短 ───

const GD_SHORT_HTML = `
<html><body>
<div class="zw"><p>太短了</p></div>
</body></html>
`;

// ─── HTML Fixture：无正文容器 ───

const GD_NO_CONTENT_HTML = `
<html><body>
<div class="other">一些其他内容</div>
</body></html>
`;

// ─── HTML Fixture：仅日期无时间 ───

const GD_DATE_ONLY_HTML = `
<html><body>
<div class="article-date">时间  :  2026-05-20</div>
<div class="zw">
  <p>　　高质量发展是全面建设社会主义现代化国家的首要任务。近年来，广东省紧紧围绕高质量发展这一主题，深入推进供给侧结构性改革，加快构建现代化产业体系，推动经济实现质的有效提升和量的合理增长。</p>
  <p>　　在科技创新方面，广东省持续加大研发投入，建设了一批具有国际影响力的科技创新平台。大湾区国际科技创新中心建设稳步推进，一批关键核心技术取得重大突破，为高质量发展提供了强有力的科技支撑。</p>
  <p>　　在产业发展方面，广东省坚持制造业当家，推动传统产业转型升级，大力发展战略性新兴产业和未来产业。新能源汽车、集成电路、人工智能等领域形成了较为完整的产业链，为经济高质量发展注入了新动能。</p>
  <p>　　在营商环境方面，广东省深入推进"放管服"改革，持续优化营商环境，市场主体活力不断增强。一系列惠企政策的出台和落实，有效降低了企业成本，提升了企业获得感。</p>
  <p>　　下一步，广东省将继续坚持高质量发展不动摇，以更大力度推进改革创新，以更高标准优化营商环境，以更实举措增进民生福祉，奋力在推进中国式现代化建设中走在前列。</p>
</div>
</body></html>
`;

describe("广东省政府网采集器", () => {
  let collector: GuangdongOfficialCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new GuangdongOfficialCollector();
  });

  describe("extractArticleDetail", () => {
    it("应该正确提取标题、正文、发布时间", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("高质量发展");
      expect(result.fullText).toContain("科技创新");
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4, 10, 13, 50));
    });

    it("应保留正文 HTML(rawHtml) 与段落结构(fullText 含 \\n\\n)", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html"
      );

      expect(result).not.toBeNull();
      // rawHtml 非空，含 <p> 结构（供详情页渲染还原段落）
      expect(result.rawHtml).toBeTruthy();
      expect(result.rawHtml).toContain("<p>");
      // fullText 为结构化纯文本，多段用 \n\n 连接（不再被挤成一行）
      expect(result.fullText).toMatch(/\n\n/);
      expect(result.fullText.split(/\n\n/).length).toBeGreaterThanOrEqual(3);
      // fullText 不应残留 HTML 标签
      expect(result.fullText).not.toContain("<p>");
    });

    it("应该提取来源（广州日报）到 author 字段", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html"
      );

      expect(result).not.toBeNull();
      expect(result.author).toContain("广州日报");
    });

    it("正文不应包含页脚、导航信息", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).not.toContain("版权所有");
      expect(result.fullText).not.toContain("导航栏");
    });

    it("正文过短（<300字）时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_SHORT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/test/short.html"
      );

      expect(result).toBeNull();
    });

    it("无正文容器时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_NO_CONTENT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/test/nocontent.html"
      );

      expect(result).toBeNull();
    });

    it("仅日期无时间时应正确解析 publishedAt", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        GD_DATE_ONLY_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/test/dateonly.html"
      );

      expect(result).not.toBeNull();
      expect(result.publishedAt).toEqual(new Date(2026, 4, 20));
    });

    it("fetchWithRetry 抛出异常时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockRejectedValue(
        new Error("网络错误")
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://www.gd.gov.cn/test/error.html"
      );

      expect(result).toBeNull();
    });
  });

  describe("extractLinksFromListPage", () => {
    it("应该提取 content/post_ 和 /zwgk/ 链接", () => {
      const $ = (collector as CollectorAny).parseHtml(GD_LIST_HTML);

      const links = (collector as CollectorAny).extractLinksFromListPage(
        $,
        "https://www.gd.gov.cn/gdywdt/bmdt/",
        null
      );

      expect(links).toHaveLength(3);
      expect(links[0].title).toBe("推动高质量发展取得新成效");
      expect(links[0].url).toContain("post_4906500.html");
      expect(links[1].title).toBe("深化改革开放推动经济社会发展");
      expect(links[2].title).toBe("广东省人民政府公报第10期");
      expect(links[2].url).toContain("/zwgk/");
    });

    it("应该将相对路径转为绝对 URL", () => {
      const $ = (collector as CollectorAny).parseHtml(GD_LIST_HTML);

      const links = (collector as CollectorAny).extractLinksFromListPage(
        $,
        "https://www.gd.gov.cn/gdywdt/bmdt/",
        null
      );

      expect(links[0].url).toBe(
        "https://www.gd.gov.cn/gdywdt/bmdt/content/post_4906500.html"
      );
    });

    it("应该过滤重复 URL", () => {
      const html = `
        <div>
          <a href="/gdywdt/bmdt/content/post_4906500.html">第一篇标题A</a>
          <a href="/gdywdt/bmdt/content/post_4906500.html">重复链接标题B</a>
          <a href="/gdywdt/bmdt/content/post_4906501.html">第二篇标题C</a>
        </div>
      `;
      const $ = (collector as CollectorAny).parseHtml(html);

      const links = (collector as CollectorAny).extractLinksFromListPage(
        $,
        "https://www.gd.gov.cn/gdywdt/bmdt/",
        null
      );

      expect(links).toHaveLength(2);
      expect(links[0].title).toBe("第一篇标题A");
      expect(links[1].title).toBe("第二篇标题C");
    });

    it("应该过滤非文章链接（css/js/png/index/list）", () => {
      const $ = (collector as CollectorAny).parseHtml(GD_LIST_HTML);

      const links = (collector as CollectorAny).extractLinksFromListPage(
        $,
        "https://www.gd.gov.cn/gdywdt/bmdt/",
        null
      );

      // 不应包含 /index.html, /list.html, .css, .png
      const urls = links.map((l: { url: string }) => l.url);
      expect(urls.some((u: string) => u.includes("index."))).toBe(false);
      expect(urls.some((u: string) => u.includes("list."))).toBe(false);
      expect(urls.some((u: string) => u.endsWith(".css"))).toBe(false);
      expect(urls.some((u: string) => u.endsWith(".png"))).toBe(false);
    });

    it("应该过滤标题过短（<4字）或过长（>100字）的链接", () => {
      const html = `
        <div>
          <a href="/gdywdt/bmdt/content/post_111.html">这是好标题</a>
          <a href="/gdywdt/bmdt/content/post_222.html">短</a>
          <a href="/gdywdt/bmdt/content/post_333.html">${"超长标题".repeat(30)}</a>
        </div>
      `;
      const $ = (collector as CollectorAny).parseHtml(html);

      const links = (collector as CollectorAny).extractLinksFromListPage(
        $,
        "https://www.gd.gov.cn/gdywdt/bmdt/",
        null
      );

      expect(links).toHaveLength(1);
      expect(links[0].title).toBe("这是好标题");
    });
  });

  describe("collectorType 和 sourceName", () => {
    it("collectorType 应为 guangdong_official", () => {
      expect(collector.collectorType).toBe("guangdong_official");
    });

    it("sourceName 应为 广东省政府网", () => {
      expect(collector.sourceName).toBe("广东省政府网");
    });
  });
});
