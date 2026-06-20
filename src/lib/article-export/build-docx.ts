// Build a real .docx Blob from the unified ExportContent.
// Uses the `docx` library (Document / Paragraph / TextRun / ImageRun / Packer).
// One bad image never aborts the document: image load is delegated to the
// caller via `loadImages`, and any failure (or unsupported type) becomes a
// "[图片加载失败]" text placeholder. See development-prompt.md §四.3, §七.

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type {
  ExportBlock,
  ExportContent,
  ExportImage,
  ExportTextRun,
} from "./types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Max display width for an embedded image (px-equivalent docx units). */
const MAX_IMAGE_DISPLAY_WIDTH = 480;

/** Map a fetch content-type to the docx ImageRun type token. Returns null when unsupported (e.g. webp). */
export function mapContentTypeToDocx(
  contentType: string
): "jpg" | "png" | "gif" | "bmp" | null {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  switch (ct) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/bmp":
      return "bmp";
    default:
      return null; // webp / svg / unknown -> placeholder
  }
}

export interface LoadedImage {
  bytes: ArrayBuffer;
  contentType: string;
  width: number;
  height: number;
}

/** Image loader injected by the caller (browser): downloads bytes + dims, honoring limits/timeout. */
export type LoadImagesFn = (
  url: string
) => Promise<LoadedImage | null>;

/** Convert text runs into docx TextRun children, preserving highlight + [n] markers. */
function runsToChildren(runs: ExportTextRun[] = []): Array<TextRun | ExternalHyperlink> {
  const children: Array<TextRun | ExternalHyperlink> = [];
  for (const run of runs) {
    let text = run.text;
    if (run.annotationNumbers && run.annotationNumbers.length > 0) {
      text = `${text}[${run.annotationNumbers.join("][")}]`;
    }
    children.push(
      new TextRun({
        text,
        highlight: run.highlighted ? "yellow" : undefined,
      })
    );
  }
  return children;
}

/** Scale an image to fit MAX_IMAGE_DISPLAY_WIDTH while keeping aspect ratio. */
function scaleDimensions(width: number, height: number): { width: number; height: number } {
  if (!width || !height) return { width: MAX_IMAGE_DISPLAY_WIDTH, height: 300 };
  if (width <= MAX_IMAGE_DISPLAY_WIDTH) return { width, height };
  const ratio = height / width;
  return { width: MAX_IMAGE_DISPLAY_WIDTH, height: Math.round(MAX_IMAGE_DISPLAY_WIDTH * ratio) };
}

/** Build docx paragraphs for the body blocks. */
async function bodyToParagraphs(
  blocks: ExportBlock[],
  loadImages: LoadImagesFn,
  cumulativeUsed: { bytes: number }
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = Math.min(Math.max(block.level ?? 2, 1), 6);
      const heading =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
          ? HeadingLevel.HEADING_2
          : level === 3
          ? HeadingLevel.HEADING_3
          : level === 4
          ? HeadingLevel.HEADING_4
          : level === 5
          ? HeadingLevel.HEADING_5
          : HeadingLevel.HEADING_6;
      paragraphs.push(
        new Paragraph({ heading, children: runsToChildren(block.runs) })
      );
    } else if (block.type === "list-item") {
      paragraphs.push(
        new Paragraph({ bullet: { level: 0 }, children: runsToChildren(block.runs) })
      );
    } else if (block.type === "quote") {
      paragraphs.push(
        new Paragraph({
          indent: { left: 480 },
          children: runsToChildren(block.runs),
        })
      );
    } else if (block.type === "image") {
      paragraphs.push(await imageToParagraph(block.image!, loadImages, cumulativeUsed));
    } else {
      // paragraph + link
      paragraphs.push(new Paragraph({ children: runsToChildren(block.runs) }));
    }
  }

  return paragraphs;
}

async function imageToParagraph(
  image: ExportImage,
  loadImages: LoadImagesFn,
  cumulativeUsed: { bytes: number }
): Promise<Paragraph> {
  try {
    const loaded = await loadImages(image.url);
    if (!loaded) {
      return new Paragraph({ children: [new TextRun("[图片加载失败]")] });
    }
    const docxType = mapContentTypeToDocx(loaded.contentType);
    if (!docxType) {
      return new Paragraph({ children: [new TextRun("[图片加载失败]")] });
    }
    const { width, height } = scaleDimensions(loaded.width, loaded.height);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: docxType,
          data: loaded.bytes,
          transformation: { width, height },
        }),
      ],
    });
  } catch {
    return new Paragraph({ children: [new TextRun("[图片加载失败]")] });
  }
}

function metaParagraphs(content: ExportContent): Paragraph[] {
  const { meta } = content;
  const lines: Paragraph[] = [];
  lines.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: meta.title, bold: true })],
    })
  );
  lines.push(
    new Paragraph({
      children: [
        new TextRun(`来源：${meta.sourceName}`),
        new TextRun({ text: `    发布时间：${meta.publishedAt ? new Date(meta.publishedAt).toLocaleDateString("zh-CN") : "未知"}` }),
        new TextRun({ text: `    类型：${meta.contentType}` }),
      ],
    })
  );
  if (meta.excerpt) {
    lines.push(new Paragraph({ children: [new TextRun({ text: `摘要：${meta.excerpt}`, italics: true })] }));
  }
  lines.push(new Paragraph({ children: [] })); // spacer
  return lines;
}

function annotationSection(content: ExportContent): Paragraph[] {
  if (!content.includeAnnotations || content.annotations.length === 0) return [];
  const paragraphs: Paragraph[] = [
    new Paragraph({ children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "文章批注", bold: true })],
    }),
  ];
  for (const a of content.annotations) {
    const prefix = a.unlocated ? "[未定位到正文位置] " : "";
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `[${a.number}]`, bold: true }),
          new TextRun(`\n原文：${a.selectedText}`),
          new TextRun(`\n${prefix}批注：${a.comment}`),
        ],
      })
    );
  }
  return paragraphs;
}

function footerParagraphs(content: ExportContent): Paragraph[] {
  return [
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun("原文地址："),
        new ExternalHyperlink({
          children: [new TextRun({ text: content.meta.originalUrl, style: "Hyperlink" })],
          link: content.meta.originalUrl,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `导出时间：${new Date(content.meta.exportedAt).toLocaleString("zh-CN")}`,
        }),
      ],
    }),
  ];
}

export interface BuildDocxOptions {
  loadImages: LoadImagesFn;
}

/**
 * Build a .docx Blob from ExportContent.
 * Throws only for catastrophic docx assembly errors; individual image failures
 * are swallowed and replaced with placeholders.
 */
export async function buildDocxBlob(
  content: ExportContent,
  options: BuildDocxOptions
): Promise<Blob> {
  const cumulativeUsed = { bytes: 0 };
  const bodyParagraphs = await bodyToParagraphs(
    content.body,
    options.loadImages,
    cumulativeUsed
  );

  const sections = [
    ...metaParagraphs(content),
    ...bodyParagraphs,
    ...annotationSection(content),
    ...footerParagraphs(content),
  ];

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  // Packer.toBlob may return an empty-typed Blob; normalize the MIME for saveAs.
  return blob.type === DOCX_MIME ? blob : new Blob([blob], { type: DOCX_MIME });
}
