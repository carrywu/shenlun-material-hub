"use client";

// Print-only layout for the article PDF export.
// Renders a static, A4-friendly document from the unified ExportContent.
// Highlights use <mark> in the annotated version; clean version emits no
// <mark>, no [n], no annotations section. See development-prompt.md §四.2, §五.

import { forwardRef } from "react";
import type {
  ExportAnnotation,
  ExportBlock,
  ExportContent,
  ExportTextRun,
} from "@/lib/article-export/types";

interface ArticlePrintableContentProps {
  content: ExportContent;
}

function formatDate(value: string | null): string {
  if (!value) return "未知";
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return "未知";
  }
}

function Runs({ runs }: { runs?: ExportTextRun[] }) {
  if (!runs || runs.length === 0) return null;
  return (
    <>
      {runs.map((run, i) => {
        const numberSuffix =
          run.annotationNumbers && run.annotationNumbers.length > 0
            ? `[${run.annotationNumbers.join("][")}]`
            : "";
        if (run.highlighted) {
          return (
            <mark
              key={i}
              style={{ backgroundColor: "rgba(250, 204, 21, 0.4)" }}
            >
              {run.text}
              {numberSuffix}
            </mark>
          );
        }
        return (
          <span key={i}>
            {run.text}
            {numberSuffix}
          </span>
        );
      })}
    </>
  );
}

function BodyBlock({ block }: { block: ExportBlock }) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.level ?? 2, 1), 6);
      const headingClass = "printable-heading";
      switch (level) {
        case 1:
          return <h1 className={headingClass}><Runs runs={block.runs} /></h1>;
        case 2:
          return <h2 className={headingClass}><Runs runs={block.runs} /></h2>;
        case 3:
          return <h3 className={headingClass}><Runs runs={block.runs} /></h3>;
        case 4:
          return <h4 className={headingClass}><Runs runs={block.runs} /></h4>;
        case 5:
          return <h5 className={headingClass}><Runs runs={block.runs} /></h5>;
        default:
          return <h6 className={headingClass}><Runs runs={block.runs} /></h6>;
      }
    }
    case "list-item":
      return (
        <li className="printable-list-item">
          <Runs runs={block.runs} />
        </li>
      );
    case "quote":
      return (
        <blockquote className="printable-quote">
          <Runs runs={block.runs} />
        </blockquote>
      );
    case "image":
      return (
        <figure className="printable-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.image?.url} alt={block.image?.alt ?? ""} />
          {block.image?.alt ? <figcaption>{block.image.alt}</figcaption> : null}
        </figure>
      );
    default:
      return (
        <p className="printable-paragraph">
          <Runs runs={block.runs} />
        </p>
      );
  }
}

function AnnotationEntry({ annotation }: { annotation: ExportAnnotation }) {
  return (
    <li className="printable-annotation">
      <strong>[{annotation.number}]</strong>
      {" "}
      {annotation.unlocated ? (
        <em>[未定位到正文位置] </em>
      ) : null}
      <div>原文：{annotation.selectedText}</div>
      <div>批注：{annotation.comment}</div>
    </li>
  );
}

/**
 * Forwarded ref is used by react-to-print's contentRef to snapshot this node
 * for the browser print window.
 */
export const ArticlePrintableContent = forwardRef<
  HTMLDivElement,
  ArticlePrintableContentProps
>(function ArticlePrintableContent({ content }, ref) {
  const { meta, body, annotations, includeAnnotations } = content;
  const located = annotations.filter((a) => !a.unlocated);
  const unlocated = annotations.filter((a) => a.unlocated);

  return (
    <div ref={ref} data-testid="article-printable-root" className="article-printable">
      <style>{`
        .article-printable {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
          color: #1f2937;
          line-height: 1.8;
          max-width: 760px;
          margin: 0 auto;
          padding: 0;
        }
        .article-printable h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; line-height: 1.4; }
        .article-printable h2 { font-size: 18px; font-weight: 700; margin: 20px 0 8px; break-after: avoid; }
        .article-printable h3 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; break-after: avoid; }
        .article-printable .printable-meta { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
        .article-printable .printable-excerpt { font-size: 14px; color: #4b5563; font-style: italic; margin: 0 0 20px; padding: 8px 12px; background: #f9fafb; border-left: 3px solid #d1d5db; }
        .article-printable .printable-paragraph { margin: 0 0 12px; text-indent: 2em; }
        .article-printable .printable-list-item { margin: 0 0 6px 2em; }
        .article-printable .printable-quote { margin: 0 0 12px; padding: 6px 12px; border-left: 3px solid #d1d5db; color: #4b5563; }
        .article-printable .printable-image { margin: 12px 0; text-align: center; break-inside: avoid; }
        .article-printable .printable-image img { max-width: 100%; height: auto; border-radius: 6px; }
        .article-printable .printable-image figcaption { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .article-printable .printable-footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; word-break: break-all; }
        .article-printable .printable-annotations-title { font-size: 16px; font-weight: 700; margin: 24px 0 8px; break-after: avoid; }
        .article-printable .printable-annotation { margin: 0 0 10px; font-size: 14px; break-inside: avoid; }
        @media print {
          .article-printable { max-width: none; }
          @page { size: A4; margin: 18mm 16mm; }
        }
      `}</style>

      <h1>{meta.title}</h1>
      <div className="printable-meta">
        来源：{meta.sourceName}
        {"　　"}发布时间：{formatDate(meta.publishedAt)}
        {"　　"}类型：{meta.contentType}
      </div>
      {meta.excerpt ? <div className="printable-excerpt">{meta.excerpt}</div> : null}

      <div className="printable-body">
        {body.map((block, i) => {
          if (block.type === "list-item") {
            return (
              <ul key={i} className="printable-list">
                <BodyBlock block={block} />
              </ul>
            );
          }
          return <BodyBlock key={i} block={block} />;
        })}
      </div>

      {includeAnnotations && annotations.length > 0 ? (
        <section className="printable-annotations">
          <div className="printable-annotations-title">文章批注</div>
          <ol className="printable-annotation-list">
            {located.map((a) => (
              <AnnotationEntry key={a.number} annotation={a} />
            ))}
            {unlocated.map((a) => (
              <AnnotationEntry key={a.number} annotation={a} />
            ))}
          </ol>
        </section>
      ) : null}

      <div className="printable-footer">
        <div>原文地址：{meta.originalUrl}</div>
        <div>导出时间：{formatDate(meta.exportedAt)}</div>
      </div>
    </div>
  );
});
