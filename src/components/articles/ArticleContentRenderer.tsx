"use client";

import { ReactNode, useMemo } from "react";
import DOMPurify from "dompurify";

type ArticleContentRendererProps = {
  platform?: string | null;
  rawHtml?: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  className?: string;
  children?: ReactNode;
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
  onMouseUp,
  onImageClick,
}: ArticleContentRendererProps) {
  const htmlSource = rawHtml || (fullText && isLikelyHtml(fullText) ? fullText : null);
  const sanitizedHtml = useMemo(
    () => (htmlSource ? sanitizeArticleHtml(htmlSource, { platform, sourceUrl }) : ""),
    [htmlSource, platform, sourceUrl]
  );

  const baseClassName = `text-sm leading-relaxed select-text article-content prose prose-sm max-w-none ${className}`.trim();

  if (htmlSource) {
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
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
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
