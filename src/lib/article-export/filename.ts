// Build a safe export filename from an article title.
// Format: `{title}_{无批注|带批注}.{ext}`
// See docs/agent/article-export-development-prompt.md §八.

export type ExportFormat = "pdf" | "docx";
export type ExportVariant = "clean" | "annotated";

const ILLEGAL_CHARS = /[\/\\:*?"<>|]/g;
const MAX_TITLE_LENGTH = 80;
const FALLBACK_TITLE = "申论文章";
const VARIANT_SUFFIX: Record<ExportVariant, string> = {
  clean: "无批注",
  annotated: "带批注",
};

/** Sanitize the raw title into a safe filename segment (or fallback). */
function sanitizeTitle(rawTitle: string): string {
  // Remove illegal filesystem characters first.
  let s = rawTitle.replace(ILLEGAL_CHARS, "");
  // Collapse all internal whitespace runs into a single space, then trim.
  s = s.replace(/\s+/g, " ").trim();
  // Remove trailing sentence-ending punctuation (Windows dislikes trailing dots;
  // Chinese articles commonly end with 。). Covers ASCII "." and CJK 。．.
  s = s.replace(/[.。．]+$/, "");
  if (!s) return FALLBACK_TITLE;
  // Truncate to max length (by code unit; CJK chars are 1 unit each in JS).
  if (s.length > MAX_TITLE_LENGTH) s = s.slice(0, MAX_TITLE_LENGTH);
  return s;
}

export function buildExportFilename(
  title: string,
  format: ExportFormat,
  variant: ExportVariant
): string {
  const safe = sanitizeTitle(title);
  return `${safe}_${VARIANT_SUFFIX[variant]}.${format}`;
}
