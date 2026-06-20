// Unified intermediate structure for article export (PDF + Word).
// Both the printable (PDF) view and the docx builder consume this shape,
// so annotation numbering / ordering is computed once and shared.

/**
 * Type of a single block in the normalized article body.
 * Mirrors the structural elements we preserve across PDF and Word.
 */
export type ExportBlockType =
  | "heading" // h1-h6
  | "paragraph"
  | "list-item" // <li>
  | "quote" // <blockquote>
  | "image"
  | "link"; // standalone link rendered on its own

/**
 * An inline run of text. `annotationNumbers` carries the `[n]` markers
 * that belong to this run in the annotated version (empty for clean version).
 */
export interface ExportTextRun {
  text: string;
  /** Highlighted (matched by an annotation) segment in annotated version. */
  highlighted?: boolean;
  /** Annotation indices shown after this run, e.g. [1] -> [1]. 1-based. */
  annotationNumbers?: number[];
}

/**
 * A normalized body block. Text-bearing blocks use `runs`; image blocks use `image`.
 */
export interface ExportBlock {
  type: ExportBlockType;
  /** For heading blocks: 1-6. */
  level?: number;
  /** Ordered inline content for text-bearing blocks. */
  runs?: ExportTextRun[];
  /** For image blocks. */
  image?: ExportImage;
}

export interface ExportImage {
  /** Final URL to load (already proxied for wechat images). */
  url: string;
  alt?: string;
}

/**
 * Metadata shown at the top of every export version.
 * Only fields the export is allowed to include (no AI scores / tags / cards).
 */
export interface ExportMeta {
  title: string;
  sourceName: string;
  publishedAt: string | null;
  contentType: string;
  excerpt: string | null;
  originalUrl: string;
  exportedAt: string;
}

/**
 * A single annotation placed in the annotated export.
 * `number` is the 1-based index assigned by first-appearance order in the body.
 */
export interface ExportAnnotation {
  /** Stable 1-based number shown as [n] in body and list. */
  number: number;
  /** Original excerpt the annotation was created on. */
  selectedText: string;
  /** The user/AI comment text. */
  comment: string;
  /** True when the excerpt could not be located in the body text. */
  unlocated: boolean;
}

/**
 * The fully assembled export content, ready for PDF printing or docx building.
 */
export interface ExportContent {
  meta: ExportMeta;
  body: ExportBlock[];
  /** Only populated for the annotated version (empty for clean version). */
  annotations: ExportAnnotation[];
  /** Whether this is the annotated build. */
  includeAnnotations: boolean;
}

/**
 * Input annotation shape we accept (matches detail API annotation fields).
 */
export interface ExportAnnotationInput {
  id: string;
  selectedText: string;
  comment: string;
}
