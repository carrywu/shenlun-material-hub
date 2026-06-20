import { describe, it, expect } from "vitest";
import { checkNavigationContentFilter } from "../content-filter";

describe("checkNavigationContentFilter", () => {
  it("短文本 + 高短段比应被判为导航页（按段落块统计，\\n\\n 分隔）", () => {
    // 真实采集后的 fullText 是结构化文本，块级用 \n\n 连接
    const blocks = Array.from({ length: 20 }, () => "链接");
    const text = blocks.join("\n\n");
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain("疑似导航页面");
  });

  it("空文本不应被判为导航页", () => {
    const result = checkNavigationContentFilter(null);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 >= 1500 字的微信文章不应被判为导航页", () => {
    // 模拟微信文章：大量短段 + 足够总字数
    const shortLines = Array.from({ length: 200 }, () => "▲戳蓝色字关注我们");
    const contentLines = Array.from({ length: 50 }, (_, i) => `这是第${i + 1}段正文内容，每段有足够的字数来确保总字数超过一千五百字的门槛要求，这样就不会被误判为导航页面了。`);
    const text = [...shortLines, ...contentLines].join("\n\n");
    // 确认总字数 >= 1500
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeGreaterThanOrEqual(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 < 1500 字且高短段比仍被判为导航页", () => {
    const shortLines = Array.from({ length: 30 }, () => "链接文字");
    const text = shortLines.join("\n\n");
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeLessThan(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
  });

  it("回归保护：短段真实文章（<1500 字、段内 <br> 折行）不应被判为导航页", () => {
    // 一篇真实申论短文：6 个段落，每段含 <br> 折行（单 \n），
    // effectiveLength < 1500。旧逻辑按单 \n 分行会把折行算成短行误判；
    // 新逻辑按段落块（\n\n）统计，段数 <= 10 不触发门槛。
    const paragraphs = [
      "第一段：坚持高质量发展是新时代的硬道理，\n必须完整准确全面贯彻新发展理念。",
      "第二段：要深入推进供给侧结构性改革，\n加快构建现代化产业体系。",
      "第三段：科技创新是核心动力，\n要打好关键核心技术攻坚战。",
      "第四段：营商环境就是生产力，\n要持续深化放管服改革。",
      "第五段：民生是最大的政治，\n要用心用情办好民生实事。",
      "第六段：下一步要狠抓落实，\n确保各项部署落地见效。",
    ];
    const text = paragraphs.join("\n\n");
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeLessThan(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(false);
  });
});
