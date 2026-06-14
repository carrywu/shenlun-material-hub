"use client";

import { ReactNode, useMemo } from "react";
import DOMPurify from "dompurify";

type ArticleAnnotationData = {
  id: string;
  selectedText: string;
  comment: string;
  color: string;
  startOffset: number | null;
  endOffset: number | null;
};

type ArticleContentRendererProps = {
  platform?: string | null;
  rawHtml?: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  className?: string;
  children?: ReactNode;
  annotations?: ArticleAnnotationData[];
  onMouseUp?: () => void;
  onImageClick?: (src: string) => void;
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
 * 策略：在纯文本层面定位批注文本的位置，然后回溯到 HTML 的文本节点，
 * 将匹配的文本包裹在 <mark> span 中。
 *
 * @param html - 已清洗的 HTML 字符串
 * @param annotations - 批注列表（按 startOffset 排序）
 */
function insertAnnotationsIntoHtml(
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

  // 提取纯文本并记录每个文本节点在纯文本中的位置范围
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  interface TextSegment {
    node: Node;
    start: number;
    end: number;
  }

  const segments: TextSegment[] = [];
  let textOffset = 0;

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (len > 0) {
        segments.push({ node: node as Text, start: textOffset, end: textOffset + len });
        textOffset += len;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 不进入已有 mark 节点（防止重复处理）
      if ((node as Element).tagName === "MARK") return;
      node.childNodes.forEach(walk);
    }
  }

  doc.body.childNodes.forEach(walk);

  // 对每个批注，在文本段中找到匹配位置并包裹
  for (const annotation of annotations) {
    const text = annotation.selectedText;
    if (!text) continue;

      const searchStart = annotation.startOffset ?? 0;

    // 在 segments 中查找包含该文本的节点
    for (const seg of segments) {
      const segText = seg.node.textContent ?? "";

      // 如果批注指定了 startOffset，先跳过之前的 segments
      if (seg.start + segText.length <= searchStart) continue;

      // 在这个文本节点中查找
      const localStart = Math.max(0, searchStart - seg.start);
      const foundAt = segText.indexOf(text, localStart);
      if (foundAt === -1) continue;

      // 找到了！拆分文本节点并包裹
      const parent = seg.node.parentNode;
      if (!parent) continue;

      const before = seg.node.textContent!.slice(0, foundAt);
      const match = seg.node.textContent!.slice(foundAt, foundAt + text.length);
      const after = seg.node.textContent!.slice(foundAt + text.length);

      const mark = doc.createElement("mark");
      mark.setAttribute("data-annotation-id", annotation.id);
      mark.setAttribute("class", "inline-highlight");
      mark.setAttribute("title", annotation.comment);
      mark.style.backgroundColor = annotation.color + "40";
      mark.style.borderBottom = `2px solid ${annotation.color}`;
      mark.style.padding = "1px 0";
      mark.textContent = match;

      if (before) parent.insertBefore(doc.createTextNode(before), seg.node);
      parent.insertBefore(mark, seg.node);
      if (after) parent.insertBefore(doc.createTextNode(after), seg.node);
      parent.removeChild(seg.node);

      // 更新后续 segments 的偏移（因为我们修改了 DOM）
      // 为了简化，找到后跳出（批注已按位置排序）
      break;
    }
  }

  return doc.body.innerHTML;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ArticleContentRenderer({
  platform,
  rawHtml,
  fullText,
  sourceUrl,
  className = "",
  children,
  annotations,
  onMouseUp,
  onImageClick,
}: ArticleContentRendererProps) {
  const htmlSource = rawHtml || (fullText && isLikelyHtml(fullText) ? fullText : null);
  const sanitizedHtml = useMemo(
    () => (htmlSource ? sanitizeArticleHtml(htmlSource, { platform, sourceUrl }) : ""),
    [htmlSource, platform, sourceUrl]
  );

  // 当有 HTML 且有 annotations 时，将批注插入 HTML
  const htmlWithAnnotations = useMemo(() => {
    if (!sanitizedHtml || !annotations || annotations.length === 0) return null;
    return insertAnnotationsIntoHtml(sanitizedHtml, annotations);
  }, [sanitizedHtml, annotations]);

  const baseClassName = `text-sm leading-relaxed select-text article-content prose prose-sm max-w-none ${className}`.trim();

  if (htmlSource) {
    // 优先使用带批注的 HTML，回退到纯 HTML
    const finalHtml = htmlWithAnnotations ?? sanitizedHtml;

    return (
      <div
        data-testid="article-content"
        className={`${baseClassName} cursor-pointer`}
        onMouseUp={onMouseUp}
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
