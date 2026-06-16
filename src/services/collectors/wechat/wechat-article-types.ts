/**
 * 微信文章统一类型
 * 替代 WeRssArticle / WeRssSource，适配 we-mp-rss API 和 SQLite fallback。
 *
 * 字段映射（we-mp-rss → WechatArticle）：
 *   id              → id
 *   title           → title
 *   url             → url
 *   content         → content（已清洗 HTML，GATHER_CLEAN_HTML=True）
 *   content_html    → rawHtml（原始 HTML）
 *   description     → summary
 *   mp_id           → accountId
 *   pic_url         → cover
 *   has_content     → hasContent（0=缺失, 1=已有）
 *   fix_fail_count  → fixFailCount
 *   publish_time    → publishTime
 *   create_time     → createdAt
 */

export interface WechatArticle {
  id: string;
  title: string;
  url: string;
  content?: string;       // 已清洗 HTML（GATHER_CLEAN_HTML=True）
  rawHtml?: string;       // 原始 HTML（content_html）
  summary?: string;       // 文章摘要（description）
  author?: string;        // 作者（从 feed 信息带入）
  publishTime?: string;   // 发布时间 ISO 格式
  accountId?: string;     // 公众号 mp_id
  accountName?: string;   // 公众号名称（从 feed 信息带入）
  cover?: string;         // 封面图（pic_url）
  hasContent?: number;    // 0=缺失, 1=已有（we-mp-rss 专有）
  fixFailCount?: number;  // 自动补抓失败次数（we-mp-rss 专有）
}

/**
 * 将 WeMpRssArticle（API/SQLite 返回格式）转换为 WechatArticle。
 */
export function fromWeMpRssArticle(
  apiArticle: {
    id: string;
    mpId: string;
    title: string;
    picUrl?: string;
    url: string;
    description?: string;
    content?: string;
    contentHtml?: string;
    hasContent: number;
    fixFailCount: number;
    publishTime?: number;
    createdAt?: number;
  },
  feedName?: string
): WechatArticle {
  return {
    id: apiArticle.id,
    title: apiArticle.title,
    url: apiArticle.url,
    content: apiArticle.content ?? undefined,
    rawHtml: apiArticle.contentHtml ?? undefined,
    summary: apiArticle.description ?? undefined,
    accountId: apiArticle.mpId,
    accountName: feedName,
    cover: apiArticle.picUrl ?? undefined,
    hasContent: apiArticle.hasContent,
    fixFailCount: apiArticle.fixFailCount,
    publishTime: apiArticle.publishTime
      ? new Date(apiArticle.publishTime * 1000).toISOString()
      : undefined,
  };
}
