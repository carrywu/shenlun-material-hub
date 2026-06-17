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

import { PeopleOpinionCollector } from "../web/peopleOpinion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CollectorAny = any;

// ─── HTML Fixture：人民网观点文章详情页 ───

const OPINION_ARTICLE_HTML = `
<!doctype html>
<html>
<head><title>人民网观点频道</title></head>
<body>
<div class="fl">2026年06月04日</div>
<div class="rm_txt_con">
  <div class="fl"><a href="/author/1">张三</a></div>
  <p>　　推动经济社会高质量发展，是实现中国式现代化的必由之路。面对复杂多变的国际形势和艰巨繁重的国内改革发展稳定任务，我们必须坚持底线思维，增强忧患意识，提高统筹发展和安全的能力。</p>
  <p>　　在新时代新征程上，要始终把解决好"三农"问题作为全党工作的重中之重，全面推进乡村振兴，加快建设农业强国。要坚持农业农村优先发展，巩固拓展脱贫攻坚成果，扎实推动乡村产业、人才、文化、生态、组织振兴。</p>
  <p>　　要加快建设现代化产业体系，坚持把发展经济的着力点放在实体经济上，推进新型工业化，加快建设制造强国、质量强国、网络强国、数字中国。</p>
  <p>　　要促进区域协调发展，深入实施区域协调发展战略、区域重大战略、主体功能区战略、新型城镇化战略，优化重大生产力布局，构建优势互补、高质量发展的区域经济布局和国土空间体系。</p>
  <p>　　要推进高水平对外开放，稳步扩大规则、规制、管理、标准等制度型开放，加快建设贸易强国，推动共建"一带一路"高质量发展，维护多元稳定的国际经济格局和经贸关系。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：使用 #rwb_zw 选择器 ───

const OPINION_RWBZW_HTML = `
<!doctype html>
<html>
<head><title>人民网观点</title></head>
<body>
<div class="date">2026年05月15日</div>
<div id="rwb_zw">
  <p>　　科技自立自强是国家强盛之基、安全之要。必须坚持科技是第一生产力、人才是第一资源、创新是第一动力，深入实施科教兴国战略、人才强国战略、创新驱动发展战略，开辟发展新领域新赛道，不断塑造发展新动能新优势。</p>
  <p>　　要坚持创新在我国现代化建设全局中的核心地位，健全新型举国体制，强化国家战略科技力量，提升国家创新体系整体效能。要加强基础研究，突出原创，鼓励自由探索，提升原创引领能力。</p>
  <p>　　要加快实施一批具有战略性全局性前瞻性的国家重大科技项目，增强自主创新能力。要营造有利于科技型中小微企业成长的良好环境，推动创新链产业链资金链人才链深度融合。</p>
  <p>　　要扩大国际科技交流合作，加强国际化科研环境建设，形成具有全球竞争力的开放创新生态。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：使用 .article_content 选择器 ───

const OPINION_ARTICLECONTENT_HTML = `
<!doctype html>
<html>
<head><title>人民网评论</title></head>
<body>
<div class="fl">2026年04月10日</div>
<div class="author">李四</div>
<div class="article_content">
  <p>　　文化自信是一个国家、一个民族发展中最基本、最深沉、最持久的力量。全面建设社会主义现代化国家，必须坚持中国特色社会主义文化发展道路，增强文化自信，围绕举旗帜、聚民心、育新人、兴文化、展形象建设社会主义文化强国。</p>
  <p>　　我们要坚持马克思主义在意识形态领域指导地位的根本制度，坚持为人民服务、为社会主义服务，坚持百花齐放、百家争鸣，坚持创造性转化、创新性发展，不断夯实马克思主义中国化时代化的历史基础和群众基础。</p>
  <p>　　要以社会主义核心价值观为引领，发展社会主义先进文化，弘扬革命文化，传承中华优秀传统文化，满足人民日益增长的精神文化需求，不断提升国家文化软实力和中华文化影响力。</p>
  <p>　　要加强国际传播能力建设，形成同我国综合国力和国际地位相匹配的国际话语权，营造有利于改革发展的国际舆论环境。要深化文明交流互鉴，推动中华文化更好走向世界。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：正文过短 ───

const OPINION_SHORT_HTML = `
<html><body>
<div class="rm_txt_con"><p>太短了</p></div>
</body></html>
`;

// ─── HTML Fixture：无正文容器 ───

const OPINION_NO_CONTENT_HTML = `
<html><body>
<div class="other">一些其他内容</div>
</body></html>
`;

// ─── HTML Fixture：无日期 ───

const OPINION_NO_DATE_HTML = `
<html><body>
<div class="rm_txt_con">
  <p>　　推动经济社会高质量发展，是实现中国式现代化的必由之路。面对复杂多变的国际形势和艰巨繁重的国内改革发展稳定任务，我们必须坚持底线思维，增强忧患意识，提高统筹发展和安全的能力。</p>
  <p>　　在新时代新征程上，要始终把解决好"三农"问题作为全党工作的重中之重，全面推进乡村振兴，加快建设农业强国。要坚持农业农村优先发展，巩固拓展脱贫攻坚成果，扎实推动乡村产业、人才、文化、生态、组织振兴。</p>
  <p>　　要加快建设现代化产业体系，坚持把发展经济的着力点放在实体经济上，推进新型工业化，加快建设制造强国、质量强国、网络强国、数字中国。</p>
  <p>　　要促进区域协调发展，深入实施区域协调发展战略、区域重大战略、主体功能区战略、新型城镇化战略，优化重大生产力布局。</p>
  <p>　　要推进高水平对外开放，稳步扩大规则、规制、管理、标准等制度型开放，加快建设贸易强国。</p>
</div>
</body></html>
`;

describe("人民网观点采集器", () => {
  let collector: PeopleOpinionCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new PeopleOpinionCollector();
  });

  describe("extractArticleDetail", () => {
    it("应该正确提取正文、发布时间（.rm_txt_con 选择器）", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/GB/8213/49160/202606/t20260604_123456.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("高质量发展");
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4));
    });

    it("应该提取作者到 author 字段", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/GB/8213/49160/202606/t20260604_123456.html"
      );

      expect(result).not.toBeNull();
      expect(result.author).toContain("张三");
    });

    it("应该支持 #rwb_zw 选择器", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_RWBZW_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/GB/8213/49160/202605/t20260515_654321.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("科技自立自强");
      expect(result.publishedAt).toEqual(new Date(2026, 4, 15));
    });

    it("应该支持 .article_content 选择器 + .author 作者", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_ARTICLECONTENT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/GB/8213/49160/202604/content.html"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("文化自信");
      expect(result.author).toContain("李四");
    });

    it("正文过短（<300字）时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_SHORT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/short.html"
      );

      expect(result).toBeNull();
    });

    it("无正文容器时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_NO_CONTENT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/nocontent.html"
      );

      expect(result).toBeNull();
    });

    it("无日期时 publishedAt 应为 undefined", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        OPINION_NO_DATE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/nodate.html"
      );

      expect(result).not.toBeNull();
      expect(result.publishedAt).toBeUndefined();
    });

    it("fetchWithRetry 抛出异常时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockRejectedValue(
        new Error("HTTP 500")
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://opinion.people.com.cn/error.html"
      );

      expect(result).toBeNull();
    });
  });

  describe("collectorType 和 sourceName", () => {
    it("collectorType 应为 people_opinion", () => {
      expect(collector.collectorType).toBe("people_opinion");
    });

    it("sourceName 应为 人民网观点", () => {
      expect(collector.sourceName).toBe("人民网观点");
    });
  });
});
