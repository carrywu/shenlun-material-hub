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

import { PeoplesDailyCollector } from "../web/peoplesDaily";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CollectorAny = any;

// ─── HTML Fixture：人民日报文章详情页 ───

const RMRB_ARTICLE_HTML = `
<!doctype html>
<html>
<head><title>人民日报文章</title></head>
<body>
<div class="fl">2026年06月04日</div>
<div class="ozmwen">
  <p>　　高质量发展是全面建设社会主义现代化国家的首要任务。发展是党执政兴国的第一要务，没有坚实的物质技术基础，就不可能全面建成社会主义现代化强国。</p>
  <p>　　进入新时代，我国经济发展进入新常态，已由高速增长阶段转向高质量发展阶段。推动高质量发展，是保持经济持续健康发展的必然要求，是适应我国社会主要矛盾变化和全面建成小康社会、全面建设社会主义现代化国家的必然要求，是遵循经济规律发展的必然要求。</p>
  <p>　　推动高质量发展，要坚持以供给侧结构性改革为主线，着力提高供给体系质量和效率。要加快实施创新驱动发展战略，强化现代化建设人才支撑，加快实现高水平科技自立自强。</p>
  <p>　　要坚持社会主义市场经济改革方向，坚持高水平对外开放，加快构建以国内大循环为主体、国内国际双循环相互促进的新发展格局。</p>
  <p>　　在全面建设社会主义现代化国家的新征程上，我们必须坚定不移地推动高质量发展，不断实现人民对美好生活的向往，为全面推进中华民族伟大复兴而团结奋斗。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：使用 #ozoom 选择器 ───

const RMRB_OZOOM_HTML = `
<!doctype html>
<html>
<head><title>人民日报ozoom</title></head>
<body>
<div class="date">2026年05月20日</div>
<div id="ozoom">
  <p>　　中国式现代化是中国共产党领导的社会主义现代化。中国式现代化是人口规模巨大的现代化，是全体人民共同富裕的现代化，是物质文明和精神文明相协调的现代化，是人与自然和谐共生的现代化，是走和平发展道路的现代化。</p>
  <p>　　中国式现代化的本质要求是：坚持中国共产党领导，坚持中国特色社会主义，实现高质量发展，发展全过程人民民主，丰富人民精神世界，实现全体人民共同富裕，促进人与自然和谐共生，推动构建人类命运共同体，创造人类文明新形态。</p>
  <p>　　全面建成社会主义现代化强国，总的战略安排是分两步走：从二〇二〇年到二〇三五年基本实现社会主义现代化；从二〇三五年到本世纪中叶把我国建成富强民主文明和谐美丽的社会主义现代化强国。</p>
  <p>　　在全面建设社会主义现代化国家新征程上，我们要坚持以中国式现代化全面推进中华民族伟大复兴，不断为人类作出新的更大贡献。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：使用 .text_con 选择器 ───

const RMRB_TEXTCON_HTML = `
<!doctype html>
<html>
<head><title>人民网文章</title></head>
<body>
<div class="fl">2026年06月01日</div>
<div class="text_con">
  <p>　　推进中国式现代化是一个系统工程，需要统筹兼顾、系统谋划、整体推进。要增强系统观念，统筹国内国际两个大局，统筹推进"五位一体"总体布局、协调推进"四个全面"战略布局，统筹发展和安全，统筹城乡区域协调发展，统筹物质文明和精神文明建设。</p>
  <p>　　要坚持稳中求进工作总基调，完整、准确、全面贯彻新发展理念，加快构建新发展格局，着力推动高质量发展，全面深化改革开放，推动高水平科技自立自强，加快建设现代化产业体系。</p>
  <p>　　要着力扩大国内需求，充分发挥消费的基础作用和投资的关键作用，把实施扩大内需战略同深化供给侧结构性改革有机结合起来，增强国内大循环内生动力和可靠性，提升国际循环质量和水平。</p>
  <p>　　要加快建设现代化经济体系，推动经济发展质量变革、效率变革、动力变革，提高全要素生产率，不断增强我国经济创新力和竞争力。</p>
</div>
</body>
</html>
`;

// ─── HTML Fixture：正文过短 ───

const RMRB_SHORT_HTML = `
<html><body>
<div class="ozmwen"><p>太短了</p></div>
</body></html>
`;

// ─── HTML Fixture：无正文容器 ───

const RMRB_NO_CONTENT_HTML = `
<html><body>
<div class="other">一些其他内容</div>
</body></html>
`;

// ─── HTML Fixture：无日期 ───

const RMRB_NO_DATE_HTML = `
<html><body>
<div class="ozmwen">
  <p>　　高质量发展是全面建设社会主义现代化国家的首要任务。发展是党执政兴国的第一要务，没有坚实的物质技术基础，就不可能全面建成社会主义现代化强国。</p>
  <p>　　进入新时代，我国经济发展进入新常态，已由高速增长阶段转向高质量发展阶段。推动高质量发展，是保持经济持续健康发展的必然要求，是适应我国社会主要矛盾变化和全面建成小康社会、全面建设社会主义现代化国家的必然要求。</p>
  <p>　　推动高质量发展，要坚持以供给侧结构性改革为主线，着力提高供给体系质量和效率。要加快实施创新驱动发展战略，强化现代化建设人才支撑，加快实现高水平科技自立自强。</p>
  <p>　　要坚持社会主义市场经济改革方向，坚持高水平对外开放，加快构建以国内大循环为主体、国内国际双循环相互促进的新发展格局。</p>
  <p>　　在全面建设社会主义现代化国家的新征程上，我们必须坚定不移地推动高质量发展，不断实现人民对美好生活的向往，为全面推进中华民族伟大复兴而团结奋斗。</p>
</div>
</body></html>
`;

describe("人民日报采集器", () => {
  let collector: PeoplesDailyCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new PeoplesDailyCollector();
  });

  describe("extractArticleDetail", () => {
    it("应该正确提取正文和发布时间（.ozmwen 选择器）", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_ARTICLE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/2026-06/04/nw.D110000renmrb_01.htm"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("高质量发展");
      expect(result.fullText).toContain("供给侧结构性改革");
      expect(result.publishedAt).toEqual(new Date(2026, 5, 4));
    });

    it("应该支持 #ozoom 选择器", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_OZOOM_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/2026-05/20/nw.D110000renmrb_02.htm"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("中国式现代化");
      expect(result.publishedAt).toEqual(new Date(2026, 4, 20));
    });

    it("应该支持 .text_con 选择器", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_TEXTCON_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/2026-06/01/content.htm"
      );

      expect(result).not.toBeNull();
      expect(result.fullText).toContain("系统观念");
    });

    it("正文过短（<300字）时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_SHORT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/short.htm"
      );

      expect(result).toBeNull();
    });

    it("无正文容器时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_NO_CONTENT_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/nocontent.htm"
      );

      expect(result).toBeNull();
    });

    it("无日期时 publishedAt 应为 undefined", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockResolvedValue(
        RMRB_NO_DATE_HTML
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/nodate.htm"
      );

      expect(result).not.toBeNull();
      expect(result.publishedAt).toBeUndefined();
    });

    it("fetchWithRetry 抛出异常时应返回 null", async () => {
      vi.spyOn(collector as CollectorAny, "fetchWithRetry").mockRejectedValue(
        new Error("HTTP 503")
      );

      const result = await (collector as CollectorAny).extractArticleDetail(
        "https://paper.people.com.cn/rmrb/html/error.htm"
      );

      expect(result).toBeNull();
    });
  });

  describe("collectorType 和 sourceName", () => {
    it("collectorType 应为 peoples_daily", () => {
      expect(collector.collectorType).toBe("peoples_daily");
    });

    it("sourceName 应为 人民日报", () => {
      expect(collector.sourceName).toBe("人民日报");
    });
  });
});
