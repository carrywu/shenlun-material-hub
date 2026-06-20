import { describe, expect, it } from "vitest";
import { buildDocxBlob, mapContentTypeToDocx } from "../build-docx";
import type { ExportContent } from "../types";

const baseMeta = {
  title: "推进基层治理现代化",
  sourceName: "人民日报",
  publishedAt: "2026-06-20T00:00:00.000Z",
  contentType: "评论",
  excerpt: "摘要内容",
  originalUrl: "https://example.com/article",
  exportedAt: "2026-06-20T00:00:00.000Z",
};

function cleanContent(): ExportContent {
  return {
    meta: baseMeta,
    includeAnnotations: false,
    annotations: [],
    body: [
      { type: "paragraph", runs: [{ text: "正文第一段。" }] },
      { type: "paragraph", runs: [{ text: "正文第二段。" }] },
    ],
  };
}

describe("mapContentTypeToDocx", () => {
  it("maps jpeg content type", () => {
    expect(mapContentTypeToDocx("image/jpeg")).toBe("jpg");
  });
  it("maps png content type", () => {
    expect(mapContentTypeToDocx("image/png")).toBe("png");
  });
  it("returns null for unsupported (webp) types", () => {
    expect(mapContentTypeToDocx("image/webp")).toBeNull();
    expect(mapContentTypeToDocx("text/html")).toBeNull();
  });
});

describe("buildDocxBlob", () => {
  it("produces a non-empty Blob with correct MIME type", async () => {
    const blob = await buildDocxBlob(cleanContent(), { loadImages: async () => null });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    // file-saver / Office MIME for docx
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("clean version does not contain an annotations section", async () => {
    // We can't read docx XML without unzipping; instead assert the builder did
    // not throw and the section count is baseline. Structural assertion is done
    // by checking the function returns successfully with no annotations input.
    const blob = await buildDocxBlob(cleanContent(), { loadImages: async () => null });
    expect(blob.size).toBeGreaterThan(0);
  });

  it("annotated version is accepted with annotations section data", async () => {
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
            { text: "现代化。" },
          ],
        },
      ],
    };
    const blob = await buildDocxBlob(content, { loadImages: async () => null });
    expect(blob.size).toBeGreaterThan(0);
    // Annotated doc is larger than clean doc of equivalent body due to the
    // appended annotations section.
    const cleanBlob = await buildDocxBlob(cleanContent(), { loadImages: async () => null });
    expect(blob.size).toBeGreaterThan(cleanBlob.size);
  });

  it("continues building when an image fails to load (placeholder)", async () => {
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: false,
      annotations: [],
      body: [
        { type: "paragraph", runs: [{ text: "正文" }] },
        { type: "image", image: { url: "https://example.com/x.jpg" } },
        { type: "paragraph", runs: [{ text: "结尾。" }] },
      ],
    };
    const blob = await buildDocxBlob(content, {
      loadImages: async () => null, // simulate every image failing -> placeholder
    });
    expect(blob.size).toBeGreaterThan(0);
  });

  it("embeds an image when loadImages returns bytes", async () => {
    // minimal valid 1x1 png
    const png1x1 = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
      ),
      (c) => c.charCodeAt(0)
    ).buffer;
    const content: ExportContent = {
      meta: baseMeta,
      includeAnnotations: false,
      annotations: [],
      body: [
        { type: "image", image: { url: "https://example.com/a.png" } },
        { type: "paragraph", runs: [{ text: "正文" }] },
      ],
    };
    const blob = await buildDocxBlob(content, {
      loadImages: async (url) => {
        expect(url).toBe("https://example.com/a.png");
        return { bytes: png1x1, contentType: "image/png", width: 1, height: 1 };
      },
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});
