import { describe, expect, it } from "vitest";
import { buildExportBody } from "../build-export-content";

describe("buildExportBody", () => {
  it("returns empty array for empty html", () => {
    expect(buildExportBody("")).toEqual([]);
  });

  it("returns empty array for whitespace-only html", () => {
    expect(buildExportBody("   \n  ")).toEqual([]);
  });

  it("converts a single paragraph", () => {
    const blocks = buildExportBody("<p>推进基层治理现代化。</p>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].runs?.map((r) => r.text).join("")).toBe(
      "推进基层治理现代化。"
    );
  });

  it("converts double-newline fullText fallback into paragraphs", () => {
    const blocks = buildExportBody("第一段。\n\n第二段。");
    expect(blocks.filter((b) => b.type === "paragraph")).toHaveLength(2);
  });

  it("converts a single-newline fullText into one paragraph (no break)", () => {
    const blocks = buildExportBody("同一段\n换行不拆段");
    expect(blocks.filter((b) => b.type === "paragraph")).toHaveLength(1);
  });

  it("converts headings with levels", () => {
    const blocks = buildExportBody("<h2>二级标题</h2><h3>三级标题</h3>");
    const headings = blocks.filter((b) => b.type === "heading");
    expect(headings).toHaveLength(2);
    expect(headings[0].level).toBe(2);
    expect(headings[1].level).toBe(3);
  });

  it("converts list items", () => {
    const blocks = buildExportBody("<ul><li>要点一</li><li>要点二</li></ul>");
    const items = blocks.filter((b) => b.type === "list-item");
    expect(items).toHaveLength(2);
  });

  it("converts blockquotes", () => {
    const blocks = buildExportBody("<blockquote>引用内容</blockquote>");
    expect(blocks.filter((b) => b.type === "quote")).toHaveLength(1);
  });

  it("extracts images as image blocks", () => {
    const blocks = buildExportBody(
      '<p>正文</p><img src="https://example.com/a.jpg" alt="图">'
    );
    const imgs = blocks.filter((b) => b.type === "image");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].image?.url).toBe("https://example.com/a.jpg");
    expect(imgs[0].image?.alt).toBe("图");
  });

  it("decodes HTML entities in text", () => {
    const blocks = buildExportBody("<p>a &amp; b &lt; c</p>");
    expect(blocks[0].runs?.map((r) => r.text).join("")).toBe("a & b < c");
  });

  it("escapes script/style content (sanitized away)", () => {
    const blocks = buildExportBody(
      "<p>正文</p><script>alert(1)</script><style>x{}</style>"
    );
    // only the paragraph survives
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });
});
