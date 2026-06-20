import * as cheerio from "cheerio";
import { computeContentHash } from "@/services/content-filter";

/**
 * 网站文章正文统一提取器。
 *
 * 解决历史问题：各采集器曾用 cheerio `.text()` 抠正文，会把 <p>/<br>/<h>/列表/引用
 * 全部抹平成一行，详情页无法还原段落。本提取器同时产出：
 *  - rawHtml：清洗后的正文 HTML（去 script/style/nav/footer/广告），供详情页渲染
 *  - fullText：结构化纯文本（块级用 \n\n 连接、<br> 转 \n），供 AI/搜索/去重
 *
 * 设计原则：
 *  - 调用方传入各站选择器优先级，提取器不内置通用选择器（避免耦合）。
 *  - 父子节点去重：选中节点后若存在更具体的达标后代，改用后代，避免 .content 套 .article-content 双取。
 *  - 采集端负责「内容质量」，渲染端（DOMPurify）负责「安全」。
 */

export interface ExtractedArticleContent {
  /** 清洗后的正文 HTML（不含 script/style/nav/footer/广告），用于详情页渲染 */
  rawHtml: string;
  /** 结构化纯文本，块级元素用 \n\n 连接，<br> 转 \n，供 AI/搜索/去重 */
  fullText: string;
  /** fullText 去除所有空白后的字符数 */
  effectiveTextLength: number;
}

/** 块级元素选择器：用于结构化纯文本分段 */
const BLOCK_SELECTOR =
  "p, div, section, article, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th, caption";

/** 采集端要移除的无关/危险节点 */
const NOISE_SELECTOR =
  "script, style, iframe, form, button, nav, footer, header, noscript, svg, link, meta, input, select, textarea";

/**
 * 广告/分享/相关推荐/分页等区域。按完整词匹配，不靠单个模糊字符，
 * 避免误删含 content/text 等字样的正文容器。
 */
const NOISE_CLASS_PATTERN =
  /^(share|shared|sharing|related|recommend|recommendation|ad-|ads|advert|breadcrumb|pagination|pager|toolbar|tool-bar|pagebar|comment|comments|disqus|sidebar|copyright|footer|nav-bar|navbar)$/i;

/** 默认正文有效字数阈值（与 normalizeToContentItem 的 300 字门控一致） */
const DEFAULT_MIN_EFFECTIVE_LENGTH = 300;

/** <br> 转换用的唯一占位文本（不含空白，避免被空白归一化吞掉） */
const BREAK_PLACEHOLDER = "BR";

/**
 * fullText 去除所有空白后的字符数。
 * 与 weRssNormalizer.ts 的 effectiveTextLength 公式保持一致（fullText 已无 HTML 标签）。
 */
export function computeEffectiveLength(fullText: string): number {
  return fullText.replace(/\s+/g, "").trim().length;
}

/**
 * 复用 content-filter 的去重哈希（sha256 前 16 位），避免多份实现漂移。
 */
export function computeArticleContentHash(fullText: string): string {
  return computeContentHash(fullText);
}

function isLikelyPlaceholderImage(src: string): boolean {
  if (!src) return true;
  const trimmed = src.trim();
  if (!trimmed) return true;
  // 1x1 透明占位 gif 的常见 base64 前缀
  if (/data:image\/[^;]+;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB/i.test(trimmed)) return true;
  return false;
}

/**
 * 规范化图片 URL：相对转绝对、// 转 https、丢弃明显占位图。
 */
function resolveImageUrl(rawSrc: string | undefined, sourceUrl: string): string | null {
  if (!rawSrc) return null;
  const src = rawSrc.trim();
  if (!src || isLikelyPlaceholderImage(src)) return null;

  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (!sourceUrl) return src;
  try {
    return new URL(src, sourceUrl).toString();
  } catch {
    return src;
  }
}

/**
 * 在已选中的正文节点上修复图片：处理懒加载属性、相对 URL、删除事件属性。
 * 图片保留在原文位置（不挪到末尾）。原地修改。
 */
function fixImages($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>, sourceUrl: string): void {
  node.find("img").each((_, img) => {
    const $img = $(img);
    const lazySrc =
      $img.attr("data-src") ||
      $img.attr("data-original") ||
      $img.attr("data-actualsrc") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-url") ||
      "";
    const rawSrc = lazySrc || $img.attr("src") || "";
    const resolved = resolveImageUrl(rawSrc, sourceUrl);

    $img.removeAttr("data-src data-original data-actualsrc data-lazy-src data-url");
    $img.removeAttr("onerror onload onclick onmouseover");

    if (resolved) {
      $img.attr("src", resolved);
    } else {
      $img.remove();
    }
  });
}

/**
 * 移除正文内的噪声节点（导航/页脚/广告/分享/相关推荐等）。
 * 不粗暴删除所有 div，仅按精确选择器与完整词 class 匹配。
 */
function removeNoise($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>): void {
  node.find(NOISE_SELECTOR).remove();
  // 收集待删节点，避免遍历中修改导致跳过
  const toRemove: cheerio.Cheerio<any>[] = [];
  node.find("*").each((_, el) => {
    const $el = $(el);
    const cls = $el.attr("class") || "";
    if (!cls) return;
    const hit = cls
      .split(/\s+/)
      .some((token) => NOISE_CLASS_PATTERN.test(token));
    if (hit) toRemove.push($el);
  });
  toRemove.forEach(($el) => $el.remove());
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

/**
 * 由已清洗的正文节点生成结构化纯文本。
 * 思路与 weRssNormalizer.extractPlainText 一致：遍历块级元素，仅取无块级子节点的叶子文本，
 * 用 \n\n 连接；叶子内 <br> 转 \n（单换行），避免父子重复。
 *
 * 注意：本函数只读取文本（<br> 占位替换除外），可重复调用。
 */
function buildStructuredTextImpl(
  $: cheerio.CheerioAPI,
  node: cheerio.Cheerio<any>
): string {
  // <br> 占位替换：在取 text 前把 <br> 换成不可被空白归一化吞掉的占位文本
  node.find("br").each((_, br) => {
    $(br).replaceWith(BREAK_PLACEHOLDER);
  });

  const paragraphs: string[] = [];
  node.find(BLOCK_SELECTOR).each((_, el) => {
    const $el = $(el);
    const hasBlockChild = $el.find(BLOCK_SELECTOR).length > 0;
    if (hasBlockChild) return; // 只取叶子块，避免父子重复
    const raw = $el.text() || "";
    // 叶子内 <br> 占位 → 单换行（段内换行，不升级成段落）
    const txt = raw
      .split(BREAK_PLACEHOLDER)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    if (txt) paragraphs.push(txt);
  });

  let fullText = paragraphs.join("\n\n");
  if (!fullText) {
    // 兜底：无块级结构时取节点全部文本
    fullText = (node.text() || "")
      .split(BREAK_PLACEHOLDER)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  return normalizeText(fullText);
}

interface PreparedNode {
  /** 克隆并清洗后的 cheerio 节点 */
  node: cheerio.Cheerio<any>;
  /** 该节点的结构化纯文本（一次性计算） */
  text: string;
}

/**
 * 准备一个候选节点：克隆 → 清洗噪声 → 修图 → 计算 fullText。
 */
function prepareNode(
  $: cheerio.CheerioAPI,
  el: cheerio.AnyNode,
  sourceUrl: string
): PreparedNode {
  const node = $(el).clone();
  removeNoise($, node);
  fixImages($, node, sourceUrl);
  const text = buildStructuredTextImpl($, node);
  return { node, text };
}

/**
 * 按选择器优先级查找正文节点。
 * 选中后若存在更具体的达标后代节点，改用后代（父子去重）。
 * 返回 null 表示未找到有效正文。
 */
export function extractArticleContent(
  $: cheerio.CheerioAPI,
  selectors: string[],
  sourceUrl: string,
  options: { minEffectiveLength?: number } = {}
): ExtractedArticleContent | null {
  if (!selectors.length) return null;
  const minLen = options.minEffectiveLength ?? DEFAULT_MIN_EFFECTIVE_LENGTH;
  const descendantSel = selectors.join(",");

  for (const selector of selectors) {
    const candidates = $(selector);
    if (candidates.length === 0) continue;

    let chosen: PreparedNode | null = null;

    candidates.each((_, el) => {
      if (chosen) return;
      const prepared = prepareNode($, el, sourceUrl);

      // 父子去重：若 prepared 内有更具体的后代也命中任一 selector 且达标，优先用后代
      const descendantHit = prepared.node.find(descendantSel).first();
      if (descendantHit.length > 0) {
        // descendantHit 是 prepared.node 内的节点；需要重新清洗/计算（它继承自已清洗副本，但保险起见再清一次）
        const dPrepared = prepareNode($, descendantHit.first().get(0) as unknown as cheerio.AnyNode, sourceUrl);
        if (computeEffectiveLength(dPrepared.text) >= minLen) {
          chosen = dPrepared;
          return;
        }
      }

      if (computeEffectiveLength(prepared.text) >= minLen) {
        chosen = prepared;
      }
    });

    if (chosen) {
      const rawHtml = $.html(chosen.node);
      return {
        rawHtml,
        fullText: chosen.text,
        effectiveTextLength: computeEffectiveLength(chosen.text),
      };
    }
  }

  return null;
}
