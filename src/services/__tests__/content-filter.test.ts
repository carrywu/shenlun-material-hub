import { describe, it, expect } from "vitest";
import { checkNavigationContentFilter } from "../content-filter";

describe("checkNavigationContentFilter", () => {
  it("短文本 + 高短行比应被判为导航页", () => {
    const lines = Array.from({ length: 20 }, () => "链接");
    const text = lines.join("\n");
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain("疑似导航页面");
  });

  it("空文本不应被判为导航页", () => {
    const result = checkNavigationContentFilter(null);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 >= 1500 字的微信文章不应被判为导航页", () => {
    // 模拟微信文章：大量短行 + 足够总字数
    const shortLines = Array.from({ length: 200 }, () => "▲戳蓝色字关注我们");
    const contentLines = Array.from({ length: 50 }, (_, i) => `这是第${i + 1}段正文内容，每段有足够的字数来确保总字数超过一千五百字的门槛要求，这样就不会被误判为导航页面了。`);
    const text = [...shortLines, ...contentLines].join("\n");
    // 确认总字数 >= 1500
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeGreaterThanOrEqual(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 < 1500 字且高短行比仍被判为导航页", () => {
    const shortLines = Array.from({ length: 30 }, () => "链接文字");
    const text = shortLines.join("\n");
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeLessThan(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
  });
});
