import { describe, expect, it } from "vitest";
import { buildAnnotatedContent } from "../build-annotated-content";
import type { ExportBlock } from "../types";

function paragraph(text: string): ExportBlock {
  return { type: "paragraph", runs: [{ text }] };
}

describe("buildAnnotatedContent", () => {
  it("returns body unchanged and empty annotations when no annotations", () => {
    const body = [paragraph("正文内容")];
    const result = buildAnnotatedContent(body, []);
    expect(result.annotations).toEqual([]);
    // no highlighted runs, no annotation numbers
    result.body.forEach((b) =>
      b.runs?.forEach((r) => {
        expect(r.highlighted).toBeFalsy();
        expect(r.annotationNumbers).toBeUndefined();
      })
    );
  });

  it("marks the matched text as highlighted and assigns a number", () => {
    const body = [paragraph("推进基层治理现代化")];
    const result = buildAnnotatedContent(body, [
      { id: "a1", selectedText: "基层治理", comment: "可用于治理类" },
    ]);
    const highlighted = result.body[0].runs!.filter((r) => r.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe("基层治理");
    expect(highlighted[0].annotationNumbers).toEqual([1]);
    expect(result.annotations).toEqual([
      { number: 1, selectedText: "基层治理", comment: "可用于治理类", unlocated: false },
    ]);
  });

  it("numbers annotations by first-appearance order in body, not by input order", () => {
    const body = [paragraph("甲乙丙丁")];
    // input order is reversed relative to body appearance
    const result = buildAnnotatedContent(body, [
      { id: "a2", selectedText: "丙丁", comment: "后出现" },
      { id: "a1", selectedText: "甲乙", comment: "先出现" },
    ]);
    expect(result.annotations.map((a) => a.number)).toEqual([1, 2]);
    expect(result.annotations[0].selectedText).toBe("甲乙"); // body-first gets number 1
    expect(result.annotations[1].selectedText).toBe("丙丁");
  });

  it("createdAt / input order does NOT override body-position numbering", () => {
    const body = [paragraph("一二三四五")];
    const result = buildAnnotatedContent(body, [
      { id: "late", selectedText: "四五", comment: "later" },
      { id: "early", selectedText: "一二", comment: "earlier" },
    ]);
    // "一二" appears first in body -> number 1 even though listed second
    const one = result.annotations.find((a) => a.number === 1)!;
    expect(one.selectedText).toBe("一二");
  });

  it("keeps multiple annotations on the same text with [1][2]", () => {
    const body = [paragraph("枫桥经验")];
    const result = buildAnnotatedContent(body, [
      { id: "a", selectedText: "枫桥经验", comment: "批注A" },
      { id: "b", selectedText: "枫桥经验", comment: "批注B" },
    ]);
    const runs = result.body[0].runs!;
    // find the highlighted run that carries both numbers
    const multi = runs.find((r) => r.highlighted && r.annotationNumbers?.length === 2);
    expect(multi).toBeTruthy();
    expect(multi!.annotationNumbers).toEqual([1, 2]);
  });

  it("locates AI excerpts when Chinese quote styles differ from the body", () => {
    const body = [paragraph("当地管理处试行“限时拍摄”，受到大家支持。")];
    const result = buildAnnotatedContent(body, [
      { id: "quote", selectedText: "当地管理处试行‘限时拍摄’，受到大家支持。", comment: "治理案例" },
    ]);

    expect(result.annotations[0].unlocated).toBe(false);
    expect(result.body[0].runs!.some((r) => r.highlighted)).toBe(true);
  });

  it("keeps a contained shorter annotation in the body instead of marking it unlocated", () => {
    const body = [paragraph("有些风景，适合抵达；有些风景，适合远望。对我们来说，游玩有分寸。")];
    const result = buildAnnotatedContent(body, [
      {
        id: "long",
        selectedText: "有些风景，适合抵达；有些风景，适合远望。对我们来说，游玩有分寸。",
        comment: "完整金句",
      },
      {
        id: "short",
        selectedText: "有些风景，适合抵达；有些风景，适合远望。",
        comment: "短金句",
      },
    ]);

    expect(result.annotations).toHaveLength(2);
    expect(result.annotations.every((a) => !a.unlocated)).toBe(true);
    const highlightedText = result.body[0].runs!
      .filter((r) => r.highlighted)
      .map((r) => `${r.text}:${r.annotationNumbers?.join(",")}`)
      .join("|");
    expect(highlightedText).toContain("1,2");
  });

  it("still matches when excerpt and body differ only in whitespace", () => {
    const body = [paragraph("坚持 和 发展 新时代 枫桥 经验")];
    const result = buildAnnotatedContent(body, [
      { id: "a1", selectedText: "坚持和发展新时代枫桥经验", comment: "x" },
    ]);
    expect(result.annotations[0].unlocated).toBe(false);
    expect(result.body[0].runs!.some((r) => r.highlighted)).toBe(true);
  });

  it("matches across text node / structural boundaries", () => {
    // sentence split across two paragraphs is uncommon; more realistic:
    // selected text spans a <strong> boundary -> represented as two runs after build.
    // Simulate via a heading + paragraph whose joined text contains the excerpt.
    const body: ExportBlock[] = [
      { type: "heading", level: 2, runs: [{ text: "坚持和发展" }] },
      paragraph("新时代枫桥经验"),
    ];
    const result = buildAnnotatedContent(body, [
      { id: "a1", selectedText: "发展新时代枫桥", comment: "跨块" },
    ]);
    expect(result.annotations[0].unlocated).toBe(false);
  });

  it("keeps unlocated annotations in the list marked as unlocated, without injecting a number in body", () => {
    const body = [paragraph("完全不相关的正文")];
    const result = buildAnnotatedContent(body, [
      { id: "miss", selectedText: "这段文字不在正文里", comment: "找不到" },
    ]);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].unlocated).toBe(true);
    // body must contain no highlighted run / no annotation number
    result.body.forEach((b) =>
      b.runs?.forEach((r) => {
        expect(r.highlighted).toBeFalsy();
        expect(r.annotationNumbers).toBeUndefined();
      })
    );
  });

  it("assigns unlocated annotations numbers continuing after located ones, ordered by input", () => {
    const body = [paragraph("甲乙")];
    const result = buildAnnotatedContent(
      body,
      [
        { id: "hit", selectedText: "甲乙", comment: "命中" },
        { id: "miss1", selectedText: "不存在一", comment: "未命中一" },
        { id: "miss2", selectedText: "不存在二", comment: "未命中二" },
      ]
    );
    const nums = result.annotations.map((a) => a.number);
    expect(nums).toEqual([1, 2, 3]);
    expect(result.annotations[0].unlocated).toBe(false);
    expect(result.annotations[1].unlocated).toBe(true);
    expect(result.annotations[2].unlocated).toBe(true);
  });

  it("is stable: same input always yields the same numbering", () => {
    const body = [paragraph("甲乙丙丁戊己")];
    const input = [
      { id: "x3", selectedText: "戊己", comment: "c" },
      { id: "x1", selectedText: "甲乙", comment: "a" },
      { id: "x2", selectedText: "丙丁", comment: "b" },
    ];
    const r1 = buildAnnotatedContent(body, input);
    const r2 = buildAnnotatedContent(body, input);
    expect(r1.annotations).toEqual(r2.annotations);
    expect(r1.annotations.map((a) => a.selectedText)).toEqual(["甲乙", "丙丁", "戊己"]);
  });

  it("does not corrupt the body text content", () => {
    const body = [paragraph("推进基层治理现代化")];
    const result = buildAnnotatedContent(body, [
      { id: "a1", selectedText: "基层治理", comment: "x" },
    ]);
    const reconstructed = result.body[0].runs!.map((r) => r.text).join("");
    expect(reconstructed).toBe("推进基层治理现代化");
  });
});
