"use client";

import { MouseEvent as ReactMouseEvent, ReactNode, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  buildNormalizedStream,
  locateAnnotationRanges,
} from "@/lib/article-export/annotation-match";

type ArticleAnnotationData = {
  id: string;
  selectedText: string;
  comment: string;
  color: string;
  startOffset: number | null;
  endOffset: number | null;
};

type ArticleContentRendererProps<T extends ArticleAnnotationData = ArticleAnnotationData> = {
  platform?: string | null;
  rawHtml?: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  className?: string;
  children?: ReactNode;
  annotations?: T[];
  onMouseUp?: () => void;
  onImageClick?: (src: string) => void;
  /** 鼠标进入/离开某个批注高亮时上报该批注（用于父层渲染悬浮气泡）；离开高亮传 null。 */
  onAnnotationHover?: (annotation: T | null) => void;
};

const ALLOWED_TAGS = [
  "p", "img", "strong", "em", "b", "i", "u", "s",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "br", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "span", "div", "section", "article",
];

const ALLOWED_ATTR = [
  "src", "alt", "class", "style", "href", "target", "rel",
  "width", "height", "data-src", "title",
];

function isLikelyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function resolveUrl(value: string, sourceUrl?: string | null): string {
  if (!value) return value;
  if (/^(https?:|data:|blob:|\/api\/)/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (!sourceUrl) return value;

  try {
    return new URL(value, sourceUrl).toString();
  } catch {
    return value;
  }
}

function isWechatImage(value: string): boolean {
  return (
    value.includes("mmbiz.qpic.cn") ||
    value.includes("wx.qpic.cn") ||
    value.includes("mmbiz.qlogo.cn")
  );
}

export function sanitizeArticleHtml(
  html: string,
  options: { platform?: string | null; sourceUrl?: string | null } = {}
): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });

  if (typeof window === "undefined") return clean;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, "text/html");

    doc.querySelectorAll("script, style, head, iframe, noscript, svg, link, meta").forEach((el) => el.remove());

    doc.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      link.setAttribute("href", resolveUrl(href, options.sourceUrl));
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noreferrer");
    });

    doc.querySelectorAll("img").forEach((img) => {
      const dataSrc = img.getAttribute("data-src") || "";
      const src = img.getAttribute("src") || "";
      const candidate = dataSrc || src;
      let nextSrc = resolveUrl(candidate, options.sourceUrl);

      if (options.platform === "wechat" && isWechatImage(nextSrc)) {
        nextSrc = `/api/proxy/image?url=${encodeURIComponent(nextSrc)}`;
      }

      if (nextSrc) {
        img.setAttribute("src", nextSrc);
      }
      img.removeAttribute("data-src");
      img.setAttribute("loading", "lazy");
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "1rem auto";
      img.style.borderRadius = "0.375rem";
    });

    return doc.body.innerHTML;
  } catch {
    return clean;
  }
}

/**
 * 在 HTML 字符串中插入批注高亮 span。
 *
 * 策略：把「批注文本」与「正文文本」都做**空白归一化**后匹配（折叠所有空白），
 * 因此即便 AI 摘抄与库里正文存在换行/空格差异（实测 4/5 漏匹配就是这个原因），
 * 仍能命中。匹配可**跨文本节点**（一句话被 <p>/<br> 切断时），
 * 每个命中的原始文本节点各包一个 <mark>，共享同一 data-annotation-id。
 *
 * 保留语义：不进入已有 MARK 节点（防重复处理）；命中失败静默跳过。
 *
 * @param html - 已清洗的 HTML 字符串
 * @param annotations - 批注列表
 */
export function insertAnnotationsIntoHtml(
  html: string,
  annotations: Array<{
    id: string;
    selectedText: string;
    comment: string;
    color: string;
    startOffset: number | null;
  }>
): string {
  if (annotations.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 记录每个原始文本节点，及其文本在「归一化全文」中的 [normStart, normEnd) 区间。
  interface TextSegment {
    node: Text;
    rawText: string;
    normText: string;
  }
  const segments: TextSegment[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? "";
      const normalized = buildNormalizedStream([{ text: raw, owner: null }]);
      const norm = normalized.stream;
      if (norm.length > 0) {
        segments.push({
          node: node as Text,
          rawText: raw,
          normText: norm,
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 不进入已有 mark 节点（防止重复处理）
      if ((node as Element).tagName === "MARK") return;
      node.childNodes.forEach(walk);
    }
  }

  doc.body.childNodes.forEach(walk);

  const normalized = buildNormalizedStream(
    segments.map((segment) => ({ text: segment.rawText, owner: segment }))
  );
  const located = locateAnnotationRanges(normalized.stream, annotations);
  const segmentCells = new Map<TextSegment, Array<{ global: number; rawStart: number; rawEnd: number }>>();
  const globalToLocal: number[] = [];
  normalized.cells.forEach((cell, global) => {
    const entries = segmentCells.get(cell.owner) ?? [];
    globalToLocal[global] = entries.length;
    entries.push({ global, rawStart: cell.rawStart, rawEnd: cell.rawEnd });
    segmentCells.set(cell.owner, entries);
  });

  const segmentAnnotationIds = new Map<TextSegment, string[][]>();
  segments.forEach((segment) => {
    const cells = segmentCells.get(segment) ?? [];
    segmentAnnotationIds.set(segment, cells.map(() => []));
  });

  located.hits.forEach((hit) => {
    for (let global = hit.range.start; global < hit.range.end; global++) {
      const cell = normalized.cells[global];
      const local = globalToLocal[global];
      segmentAnnotationIds.get(cell.owner)?.[local]?.push(hit.input.id);
    }
  });

  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]));

  segments.forEach((segment) => {
    const parent = segment.node.parentNode;
    const cells = segmentCells.get(segment) ?? [];
    const idsByCell = segmentAnnotationIds.get(segment) ?? [];
    if (!parent || cells.length === 0) return;

    let rawCursor = 0;
    let local = 0;
    while (local < cells.length) {
      const ids = idsByCell[local];
      const key = ids.join(" ");
      let endLocal = local + 1;
      while (endLocal < cells.length && idsByCell[endLocal].join(" ") === key) {
        endLocal++;
      }

      const rawStart = cells[local].rawStart;
      const rawEnd = cells[endLocal - 1].rawEnd;
      const before = segment.rawText.slice(rawCursor, rawStart);
      if (before) parent.insertBefore(doc.createTextNode(before), segment.node);

      const text = segment.rawText.slice(rawStart, rawEnd);
      if (text) {
        if (ids.length > 0) {
          const first = annotationById.get(ids[0]);
          const color = first?.color ?? "#facc15";
          const mark = doc.createElement("mark");
          mark.setAttribute("data-annotation-id", ids[0]);
          mark.setAttribute("data-annotation-ids", ids.join(" "));
          mark.setAttribute("class", "inline-highlight");
          mark.style.backgroundColor = color + "40";
          mark.style.borderBottom = `2px solid ${color}`;
          mark.style.padding = "1px 0";
          mark.textContent = text;
          parent.insertBefore(mark, segment.node);
        } else {
          parent.insertBefore(doc.createTextNode(text), segment.node);
        }
      }

      rawCursor = rawEnd;
      local = endLocal;
    }

    const rest = segment.rawText.slice(rawCursor);
    if (rest) parent.insertBefore(doc.createTextNode(rest), segment.node);
    parent.removeChild(segment.node);
  });

  return doc.body.innerHTML;
}

function splitParagraphs(text: string): string[] {
  // 先按双换行分段；若全文只有一段（或没有双换行），降级按单换行分段，
  // 兼容只含单换行的旧 fullText（无 rawHtml 的历史文章降级显示）。
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const doubleLineParagraphs = normalized
    .split(/\n\s*\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (doubleLineParagraphs.length > 1) {
    return doubleLineParagraphs;
  }

  return normalized
    .split(/\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ArticleContentRenderer<T extends ArticleAnnotationData = ArticleAnnotationData>({
  platform,
  rawHtml,
  fullText,
  sourceUrl,
  className = "",
  children,
  annotations,
  onMouseUp,
  onImageClick,
  onAnnotationHover,
}: ArticleContentRendererProps<T>) {
  const htmlSource = rawHtml || (fullText && isLikelyHtml(fullText) ? fullText : null);
  const sanitizedHtml = useMemo(
    () => (htmlSource ? sanitizeArticleHtml(htmlSource, { platform, sourceUrl }) : ""),
    [htmlSource, platform, sourceUrl]
  );

  // id → annotation 查找表，供事件委托按 data-annotation-id 取出完整批注（含 comment）。
  const annotationById = useMemo(() => {
    const m = new Map<string, T>();
    annotations?.forEach((a) => m.set(a.id, a));
    return m;
  }, [annotations]);

  const reportHoverFromEvent = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onAnnotationHover) return;
    const target = event.target as HTMLElement;
    const mark = target.closest('mark[data-annotation-id]') as HTMLElement | null;
    if (!mark) {
      onAnnotationHover(null);
      return;
    }
    const ann = annotationById.get(mark.getAttribute("data-annotation-id") || "");
    onAnnotationHover(ann ?? null);
  };

  // 当有 HTML 且有 annotations 时，将批注插入 HTML
  const htmlWithAnnotations = useMemo(() => {
    if (!sanitizedHtml || !annotations || annotations.length === 0) return null;
    return insertAnnotationsIntoHtml(sanitizedHtml, annotations);
  }, [sanitizedHtml, annotations]);

  // 纯文本（无 rawHtml）路径：把段落包成 HTML 后走同一套批注注入，确保高亮+悬浮一致。
  const plainHtmlWithAnnotations = useMemo(() => {
    if (htmlSource) return null;
    const text = fullText?.trim();
    if (!text || !annotations || annotations.length === 0) return null;
    const wrapped = splitParagraphs(text)
      .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");
    return insertAnnotationsIntoHtml(wrapped, annotations);
  }, [htmlSource, fullText, annotations]);

  const baseClassName = `text-sm leading-relaxed select-text article-content prose prose-sm max-w-none ${className}`.trim();

  if (htmlSource) {
    // 优先使用带批注的 HTML，回退到纯 HTML
    const finalHtml = htmlWithAnnotations ?? sanitizedHtml;

    return (
      <div
        data-testid="article-content"
        className={`${baseClassName} cursor-pointer`}
        onMouseUp={onMouseUp}
        onMouseMove={reportHoverFromEvent}
        onMouseLeave={() => onAnnotationHover?.(null)}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === "IMG") {
            const src = target.getAttribute("src");
            if (src) onImageClick?.(src);
          }
        }}
        onError={(event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === "IMG") {
            target.setAttribute("data-load-state", "failed");
            target.setAttribute("title", "图片加载失败");
          }
        }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
    );
  }

  if (children) {
    return (
      <div
        data-testid="article-content"
        className={`${baseClassName} whitespace-pre-wrap`}
        onMouseUp={onMouseUp}
      >
        {children}
      </div>
    );
  }

  // 纯文本路径：若有批注，用注入了 <mark> 的 HTML 渲染（与 HTML 路径共享悬浮气泡）。
  if (plainHtmlWithAnnotations) {
    return (
      <div
        data-testid="article-content"
        className={`${baseClassName} cursor-pointer`}
        onMouseUp={onMouseUp}
        onMouseMove={reportHoverFromEvent}
        onMouseLeave={() => onAnnotationHover?.(null)}
        dangerouslySetInnerHTML={{ __html: plainHtmlWithAnnotations }}
      />
    );
  }

  const text = fullText?.trim();
  if (!text) {
    return (
      <div data-testid="article-content" className={baseClassName} onMouseUp={onMouseUp}>
        暂无正文，请重新采集或查看原文
      </div>
    );
  }

  const paragraphs = splitParagraphs(text);
  return (
    <div data-testid="article-content" className={baseClassName} onMouseUp={onMouseUp}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
