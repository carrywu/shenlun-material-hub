import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ArticlePrintableContent } from "@/components/articles/ArticlePrintableContent";
import type { ExportContent } from "@/lib/article-export/types";

const baseMeta = {
  title: "推进基层治理现代化",
  sourceName: "人民日报",
  publishedAt: "2026-06-20T00:00:00.000Z",
  contentType: "评论",
  excerpt: "摘要内容",
  originalUrl: "https://example.com/article",
  exportedAt: "2026-06-20T00:00:00.000Z",
};

describe("ArticlePrintableContent", () => {
  it("renders title, source, body, and original url", () => {
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: false,
      annotations: [],
      body: [{ type: "paragraph", runs: [{ text: "正文段落。" }] }],
    };
    const { getByText, container } = render(
      <ArticlePrintableContent content={content} />
    );
    expect(getByText("推进基层治理现代化")).toBeTruthy();
    expect(getByText(/人民日报/)).toBeTruthy();
    expect(getByText("正文段落。")).toBeTruthy();
    expect(getByText(/example\.com\/article/)).toBeTruthy();
    // root carries the printable test id for the print flow
    expect(container.querySelector('[data-testid="article-printable-root"]')).toBeTruthy();
  });

  it("clean version contains no mark, no annotation numbers, no annotations section", () => {
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: false,
      annotations: [],
      body: [{ type: "paragraph", runs: [{ text: "干净正文" }] }],
    };
    const { container } = render(<ArticlePrintableContent content={content} />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).not.toContain("文章批注");
    expect(container.textContent).not.toMatch(/\[\d+\]/);
  });

  it("annotated version renders highlights, [n] numbers, and the annotations section", () => {
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: true,
      annotations: [
        { number: 1, selectedText: "基层治理", comment: "可用于治理类", unlocated: false },
      ],
      body: [
        {
          type: "paragraph",
          runs: [
            { text: "推进" },
            { text: "基层治理", highlighted: true, annotationNumbers: [1] },
            { text: "现代化" },
          ],
        },
      ],
    };
    const { container, getByText } = render(
      <ArticlePrintableContent content={content} />
    );
    expect(container.querySelector("mark")).toBeTruthy();
    expect(container.textContent).toContain("[1]");
    expect(getByText("文章批注")).toBeTruthy();
    // annotation list entry shows the comment
    expect(getByText(/可用于治理类/)).toBeTruthy();
  });

  it("marks unlocated annotations in the list", () => {
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: true,
      annotations: [
        { number: 1, selectedText: "不在正文", comment: "x", unlocated: true },
      ],
      body: [{ type: "paragraph", runs: [{ text: "正文" }] }],
    };
    const { container } = render(<ArticlePrintableContent content={content} />);
    expect(container.textContent).toContain("未定位到正文位置");
  });
});
