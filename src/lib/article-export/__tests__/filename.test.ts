import { describe, expect, it } from "vitest";
import { buildExportFilename } from "../filename";

describe("buildExportFilename", () => {
  it("produces clean pdf filename for a normal Chinese title", () => {
    expect(buildExportFilename("推进基层治理现代化", "pdf", "clean")).toBe(
      "推进基层治理现代化_无批注.pdf"
    );
  });

  it("appends 带批注 suffix for annotated version", () => {
    expect(buildExportFilename("标题", "pdf", "annotated")).toBe(
      "标题_带批注.pdf"
    );
  });

  it("uses correct docx extension", () => {
    expect(buildExportFilename("标题", "docx", "clean")).toBe(
      "标题_无批注.docx"
    );
  });

  it("strips illegal filesystem characters / \\ : * ? \" < > |", () => {
    expect(
      buildExportFilename('a/b\\c:d*e?f"g<h>i|j', "pdf", "clean")
    ).toBe("abcdefghij_无批注.pdf");
  });

  it("truncates titles longer than 80 characters", () => {
    const long = "字".repeat(100);
    const name = buildExportFilename(long, "pdf", "clean");
    // title segment before the suffix + extension should be 80 chars
    expect(name).toBe("字".repeat(80) + "_无批注.pdf");
    expect(name.length).toBe(80 + "_无批注.pdf".length);
  });

  it("uses fallback name when title is empty", () => {
    expect(buildExportFilename("", "pdf", "clean")).toBe("申论文章_无批注.pdf");
  });

  it("uses fallback name when title is only whitespace", () => {
    expect(buildExportFilename("    \t\n", "pdf", "clean")).toBe(
      "申论文章_无批注.pdf"
    );
  });

  it("uses fallback name when title is only illegal characters", () => {
    expect(buildExportFilename('\\\\///***???', "pdf", "clean")).toBe(
      "申论文章_无批注.pdf"
    );
  });

  it("collapses continuous whitespace into a single space", () => {
    expect(buildExportFilename("标题   多   空格", "pdf", "clean")).toBe(
      "标题 多 空格_无批注.pdf"
    );
  });

  it("trims leading/trailing whitespace and trailing periods", () => {
    expect(buildExportFilename("  标题。 ", "pdf", "clean")).toBe(
      "标题_无批注.pdf"
    );
  });
});
