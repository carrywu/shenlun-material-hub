"use client";

// Article export dropdown: PDF (clean/annotated) + Word (clean/annotated).
// PDF uses react-to-print (browser print window -> "Save as PDF").
// Word uses the docx builder. A shared pending state prevents concurrent
// exports. Empty body disables the menu. See development-prompt.md §三/§九.

import { useCallback, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import {
  ChevronDown,
  FileText,
  FileType2,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTENT_TYPE_LABELS } from "@/lib/display-labels";
import { buildExportBody } from "@/lib/article-export/build-export-content";
import { buildAnnotatedContent } from "@/lib/article-export/build-annotated-content";
import { buildDocxBlob } from "@/lib/article-export/build-docx";
import { buildExportFilename } from "@/lib/article-export/filename";
import { downloadBlob } from "@/lib/article-export/download-file";
import {
  fetchImageBytes,
  isAllowedImageType,
  shouldDowngradeImage,
} from "@/lib/article-export/image-loader";
import type {
  ExportAnnotationInput,
  ExportContent,
  ExportImage,
} from "@/lib/article-export/types";

export interface ArticleExportArticle {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  fullText: string | null;
  rawHtml: string | null;
  excerpt: string | null;
  contentType: string;
  publishedAt: string | null;
  source?: { name: string; platform: string } | null;
  annotations: Array<{
    id: string;
    selectedText: string;
    comment: string;
  }>;
}

export function ArticleExportMenu({ article }: { article: ArticleExportArticle }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Which kind is currently exporting (for button labels).
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const printRootRef = useRef<HTMLDivElement>(null);
  // The content currently staged for printing (set right before triggering print).
  const [printContent, setPrintContent] = useState<ExportContent | null>(null);

  const hasBody = useMemo(() => {
    const text = (article.rawHtml ?? "").trim() || (article.fullText ?? "").trim();
    return text.length > 0;
  }, [article.rawHtml, article.fullText]);

  const sourceName = article.source?.name ?? article.platform ?? "未知";
  const contentTypeLabel =
    CONTENT_TYPE_LABELS[article.contentType] ?? article.contentType ?? "未知";

  const buildBaseContent = useCallback(
    (includeAnnotations: boolean): ExportContent => {
      const body = buildExportBody(article.rawHtml ?? article.fullText, {
        platform: article.platform,
        sourceUrl: article.originalUrl,
      });

      if (includeAnnotations) {
        const inputs: ExportAnnotationInput[] = article.annotations.map((a) => ({
          id: a.id,
          selectedText: a.selectedText,
          comment: a.comment,
        }));
        const annotated = buildAnnotatedContent(body, inputs);
        return {
          meta: {
            title: article.title,
            sourceName,
            publishedAt: article.publishedAt,
            contentType: contentTypeLabel,
            excerpt: article.excerpt,
            originalUrl: article.originalUrl,
            exportedAt: new Date().toISOString(),
          },
          body: annotated.body,
          annotations: annotated.annotations,
          includeAnnotations: true,
        };
      }

      return {
        meta: {
          title: article.title,
          sourceName,
          publishedAt: article.publishedAt,
          contentType: contentTypeLabel,
          excerpt: article.excerpt,
          originalUrl: article.originalUrl,
          exportedAt: new Date().toISOString(),
        },
        body,
        annotations: [],
        includeAnnotations: false,
      };
    },
    [article, sourceName, contentTypeLabel]
  );

  const handlePrint = useReactToPrint({
    contentRef: printRootRef,
    documentTitle: article.title || "申论文章",
    pageStyle: `
      @page { size: A4; margin: 18mm 16mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    `,
    onBeforePrint: async () => {
      if (printRootRef.current) {
        const { waitForImages } = await import("@/lib/article-export/image-loader");
        await waitForImages(printRootRef.current);
      }
    },
    onPrintError: () => {
      setPending(false);
      setPendingLabel(null);
      toast.error("PDF 打印准备失败", { description: "请稍后重试" });
    },
    onAfterPrint: () => {
      setPending(false);
      setPendingLabel(null);
      setPrintContent(null);
    },
  });

  const runExport = useCallback(
    async (
      format: "pdf" | "docx",
      includeAnnotations: boolean,
      label: string
    ) => {
      if (pending) return;
      setPending(true);
      setPendingLabel(label);

      // No-annotation downgrade notice (3.7).
      if (includeAnnotations && article.annotations.length === 0) {
        toast.info("该文章暂无批注，将按不带批注版导出");
      }

      const effectiveAnnotations = includeAnnotations && article.annotations.length === 0 ? false : includeAnnotations;
      const content = buildBaseContent(effectiveAnnotations);

      try {
        if (format === "pdf") {
          // Stage content then trigger print on next tick (ref must be attached).
          setPrintContent(content);
          // Wait for state to render into the printable root, then print.
          setTimeout(() => {
            handlePrint();
          }, 0);
        } else {
          const used = { bytes: 0 };
          const blob = await buildDocxBlob(content, {
            loadImages: (url) => loadImageForDocx(url, used),
          });
          const filename = buildExportFilename(article.title, "docx", effectiveAnnotations ? "annotated" : "clean");
          downloadBlob(blob, filename);
          toast.success("Word 导出成功");
          setPending(false);
          setPendingLabel(null);
        }
      } catch (err) {
        console.error("export failed", err);
        toast.error(format === "pdf" ? "PDF 打印准备失败" : "Word 导出失败", {
          description: "请稍后重试",
        });
        setPending(false);
        setPendingLabel(null);
        setPrintContent(null);
      }
    },
    [pending, article.annotations.length, article.title, buildBaseContent, handlePrint]
  );

  const options = [
    { key: "pdf-clean", format: "pdf" as const, annot: false, label: "PDF（无批注）", testid: "article-export-pdf-clean", icon: FileText },
    { key: "pdf-annotated", format: "pdf" as const, annot: true, label: "PDF（带批注）", testid: "article-export-pdf-annotated", icon: MessageSquareText },
    { key: "word-clean", format: "docx" as const, annot: false, label: "Word（无批注）", testid: "article-export-word-clean", icon: FileType2 },
    { key: "word-annotated", format: "docx" as const, annot: true, label: "Word（带批注）", testid: "article-export-word-annotated", icon: FileType2 },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="article-export-menu"
        aria-label="导出文章"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!hasBody || pending}
        data-pending={pending ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
      >
        {pending && pendingLabel ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {pending && pendingLabel ? pendingLabel : "导出"}
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && hasBody ? (
        <div
          role="menu"
          aria-label="导出选项"
          className="absolute z-50 mt-1 right-0 w-48 rounded-md border bg-popover shadow-md p-1"
          onMouseLeave={() => !pending && setOpen(false)}
        >
          <div className="px-2 py-1 text-xs text-muted-foreground">PDF</div>
          {options.slice(0, 2).map((opt) => (
            <MenuButton key={opt.key} opt={opt} pending={pending} onClick={() => { setOpen(false); runExport(opt.format, opt.annot, opt.label); }} />
          ))}
          <div className="my-1 border-t" />
          <div className="px-2 py-1 text-xs text-muted-foreground">Word</div>
          {options.slice(2, 4).map((opt) => (
            <MenuButton key={opt.key} opt={opt} pending={pending} onClick={() => { setOpen(false); runExport(opt.format, opt.annot, opt.label); }} />
          ))}
        </div>
      ) : null}

      {/* Off-screen printable root used by react-to-print. Always mounted so the
          ref is stable; content is swapped in right before printing. */}
      <div aria-hidden style={{ position: "absolute", left: "-99999px", top: 0, width: 0, height: 0, overflow: "hidden" }}>
        {printContent ? (
          <PrintableBridge ref={printRootRef} content={printContent} />
        ) : (
          <div ref={printRootRef} />
        )}
      </div>
    </>
  );
}

// Lazily-imported printable to avoid pulling print layout into the main bundle path.
import { ArticlePrintableContent } from "@/components/articles/ArticlePrintableContent";
import { forwardRef } from "react";
const PrintableBridge = forwardRef<HTMLDivElement, { content: ExportContent }>(
  function PrintableBridge({ content }, ref) {
    return <ArticlePrintableContent ref={ref} content={content} />;
  }
);

function MenuButton({
  opt,
  pending,
  onClick,
}: {
  opt: { label: string; testid: string; icon: React.ComponentType<{ className?: string }> };
  pending: boolean;
  onClick: () => void;
}) {
  const Icon = opt.icon;
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={opt.testid}
      aria-label={opt.label}
      disabled={pending}
      data-pending={pending ? "true" : "false"}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:pointer-events-none text-left"
    >
      <Icon className="h-4 w-4" />
      {opt.label}
    </button>
  );
}

/**
 * Browser-side image loader for the docx builder. Downloads bytes via the
 * existing image proxy / direct URL, respects per-image + cumulative limits,
 * and returns null on any failure so the builder falls back to a placeholder.
 */
async function loadImageForDocx(url: string, used: { bytes: number }) {
  try {
    const { bytes, contentType } = await fetchImageBytes(url);
    if (!isAllowedImageType(contentType)) return null;
    if (shouldDowngradeImage(bytes.byteLength, used.bytes)) return null;
    used.bytes += bytes.byteLength;
    // Dimensions unknown without decoding; docx will use default scaling.
    return { bytes, contentType, width: 480, height: 320 };
  } catch {
    return null;
  }
}

// Keep ExportImage import used (referenced for clarity of the data shape).
export type { ExportImage };
