// Convert raw article HTML / fullText into the unified ExportBlock structure.
// Reuses the existing sanitizer (sanitizeArticleHtml) so we never duplicate a
// divergent cleaning pipeline. See development-prompt.md §五 (build-export-content).

import { sanitizeArticleHtml } from "@/components/articles/ArticleContentRenderer";
import type { ExportBlock, ExportTextRun } from "./types";

const HEADING_TAGS = new Map<string, number>([
  ["H1", 1],
  ["H2", 2],
  ["H3", 3],
  ["H4", 4],
  ["H5", 5],
  ["H6", 6],
]);

function isLikelyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Collect inline text runs from an element's child nodes, preserving text. */
function collectRuns(element: Element): ExportTextRun[] {
  const runs: ExportTextRun[] = [];
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      // <br> becomes a space within the same run group.
      if (el.tagName === "BR") {
        runs.push({ text: " " });
        return;
      }
      runs.push(...collectRuns(el));
    }
  });
  return runs;
}

/**
 * Build a normalized body block list from raw article content.
 *
 * Accepts either HTML (preferred, goes through sanitizeArticleHtml so images
 * are proxied for wechat and URLs resolved) or plain fullText (double-newline
 * paragraph fallback when no rawHtml exists, matching the renderer's
 * splitParagraphs degradation).
 */
export function buildExportBody(
  content: string | null | undefined,
  options: { platform?: string | null; sourceUrl?: string | null } = {}
): ExportBlock[] {
  if (!content || !content.trim()) return [];

  // Plain-text fallback: split by double newline into paragraphs.
  if (!isLikelyHtml(content)) {
    return content
      .split(/\n{2,}/)
      .map((seg) => seg.replace(/\s+/g, " ").trim())
      .filter((seg) => seg.length > 0)
      .map((seg) => ({
        type: "paragraph" as const,
        runs: [{ text: seg }],
      }));
  }

  const clean = sanitizeArticleHtml(content, {
    platform: options.platform,
    sourceUrl: options.sourceUrl,
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, "text/html");
  const blocks: ExportBlock[] = [];

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Bare text node between block elements -> wrap as paragraph.
      const text = (node.textContent ?? "").trim();
      if (text) blocks.push({ type: "paragraph", runs: [{ text }] });
      return;
    }
    const el = node as Element;

    if (HEADING_TAGS.has(el.tagName)) {
      const runs = collectRuns(el);
      if (runs.length) {
        blocks.push({ type: "heading", level: HEADING_TAGS.get(el.tagName), runs });
      }
      return;
    }
    if (el.tagName === "UL" || el.tagName === "OL") {
      // Unpack each list item as its own block, in order.
      el.querySelectorAll(":scope > li").forEach((li) => {
        const runs = collectRuns(li);
        if (runs.map((r) => r.text).join("").trim()) {
          blocks.push({ type: "list-item", runs });
        }
      });
      return;
    }
    if (el.tagName === "LI") {
      const runs = collectRuns(el);
      if (runs.length) blocks.push({ type: "list-item", runs });
      return;
    }
    if (el.tagName === "BLOCKQUOTE") {
      const runs = collectRuns(el);
      if (runs.length) blocks.push({ type: "quote", runs });
      return;
    }
    if (el.tagName === "IMG") {
      const url = el.getAttribute("src") || "";
      if (url) {
        blocks.push({ type: "image", image: { url, alt: el.getAttribute("alt") || undefined } });
      }
      return;
    }
    // Default: paragraph-like containers (p, div, section, article, table cells, etc.)
    // Images nested inside these containers are surfaced as their own blocks.
    el.querySelectorAll("img").forEach((img) => {
      const url = img.getAttribute("src") || "";
      if (url) blocks.push({ type: "image", image: { url, alt: img.getAttribute("alt") || undefined } });
    });
    const runs = collectRuns(el).filter((r) => r.text.trim() || r.text === " ");
    const text = runs.map((r) => r.text).join("").trim();
    if (text) blocks.push({ type: "paragraph", runs });
  });

  return blocks;
}
