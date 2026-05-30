// 申论素材采集台 类型定义 v3

// ==================== 枚举 ====================

// 平台
export const PLATFORMS = ["website", "wechat", "bilibili", "xiaohongshu"] as const;
export type Platform = (typeof PLATFORMS)[number];

// 内容类型（10 种）
export const CONTENT_TYPES = [
  "policy_analysis",      // 政策解读
  "social_issue",         // 社会问题
  "economic_trend",       // 经济趋势
  "cultural_heritage",    // 文化传承
  "ecological_protection", // 生态保护
  "legal_regulation",     // 法治法规
  "tech_innovation",      // 科技创新
  "education_reform",     // 教育改革
  "livelihood_welfare",   // 民生福祉
  "international_affairs", // 国际事务
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// 信任等级（5 种）
export const TRUST_LEVELS = [
  "official_primary",     // 官方一手
  "official_repost",      // 官方转载
  "verified_media",       // 认证媒体
  "expert_opinion",       // 专家观点
  "unverified",           // 未验证
] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

// 优先级
export const PRIORITIES = ["P0", "P1", "P2"] as const;
export type Priority = (typeof PRIORITIES)[number];

// 验证状态
export const VERIFICATION_STATUSES = [
  "unverified",
  "verified",
  "disputed",
  "outdated",
  "retracted",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// 处理状态
export const PROCESSING_STATUSES = [
  "pending",              // 待处理
  "fetched",              // 已抓取
  "parsed",               // 已解析
  "analyzing",            // 分析中
  "card_generated",       // 卡片已生成
  "card_edited",          // 卡片已编辑
  "confirmed",            // 已确认
  "synced",               // 已同步
  "filtered",             // 已过滤
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

// P0-2: 质量状态
export const QUALITY_STATUSES = [
  "pending",              // 待检测
  "candidate",            // 候选（通过基础过滤）
  "filtered",             // 已过滤（质量不达标）
  "accepted",             // 已接受（通过 AI 评估）
] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

// P0-2: AI 决策
export const AI_DECISIONS = [
  "pending",              // 待评估
  "accept",               // 接受
  "reject",               // 拒绝
] as const;
export type AiDecision = (typeof AI_DECISIONS)[number];

// P0-2: 内容体裁
export const CONTENT_GENRES = [
  "commentary",           // 评论文章
  "policy_interpretation", // 政策解读
  "case_practice",        // 案例实践
  "ordinary_news",        // 普通新闻
  "meeting_news",         // 会议新闻
  "notice",               // 通知公告
  "other",                // 其他
] as const;
export type ContentGenre = (typeof CONTENT_GENRES)[number];

// 卡片类型（5 种）
export const CARD_TYPES = [
  "fact_summary",         // 事实摘要
  "argument_analysis",    // 论点分析
  "data_highlight",       // 数据亮点
  "policy_compare",       // 政策对比
  "case_study",           // 案例研究
] as const;
export type CardType = (typeof CARD_TYPES)[number];

// 同步状态
export const SYNC_STATUSES = ["pending", "success", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

// 文档角色
export const DOCUMENT_ROLES = ["original_archive", "material_card"] as const;
export type DocumentRole = (typeof DOCUMENT_ROLES)[number];

// 采集器状态
export const COLLECTOR_STATUSES = ["running", "success", "partial", "failed"] as const;
export type CollectorStatus = (typeof COLLECTOR_STATUSES)[number];

// ==================== 接口 ====================

// 信息源
export interface Source {
  id: string;
  name: string;
  externalId: string | null;
  platform: Platform;
  contentType: ContentType;
  trustLevel: TrustLevel;
  regionScopes: string[];
  baseUrl: string | null;
  profileUrl: string | null;
  priority: Priority;
  collectionMode: string | null;
  isEnabled: boolean;
  verificationStatus: VerificationStatus;
  keywords: string[];
  collectionFrequency: string | null;
  lastCollectedAt: Date | null;
  lastError: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// P0-2: 采集栏目
export interface CollectionChannel {
  id: string;
  sourceId: string;
  name: string;
  listUrl: string;
  urlPattern: string | null;
  paginationPattern: string | null;
  maxPages: number;
  isEnabled: boolean;
  lastCollectedAt: Date | null;
  collectedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 内容条目
export interface ContentItem {
  id: string;
  sourceId: string;
  channelId: string | null;
  externalContentId: string | null;
  platform: Platform;
  contentType: ContentType;
  trustLevel: TrustLevel;
  title: string;
  authorOrAccount: string | null;
  originalUrl: string;
  publishedAt: Date | null;
  section: string | null;
  regionScopes: string[];
  topicTags: string[];
  excerpt: string | null;
  recommendationReason: string | null;
  verificationStatus: VerificationStatus;
  processingStatus: ProcessingStatus;
  discoveryChannel: string | null;
  fullTextStored: boolean;
  fullText: string | null;
  contentHash: string | null;
  linkedOriginalId: string | null;
  filterReason: string | null;
  // P0-2 新增字段
  qualityStatus: QualityStatus;
  effectiveTextLength: number;
  lastCleanedAt: Date | null;
  aiScore: number | null;
  aiDecision: AiDecision | null;
  aiReason: string | null;
  aiCategories: string | null;
  aiUsableFor: string | null;
  aiSummary: string | null;
  aiQuotes: string | null;
  aiAssessedAt: Date | null;
  aiAssessmentError: string | null;
  contentGenre: ContentGenre | null;
  // 兼容旧字段
  aiScoreDetail: string | null;
  aiScoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// AI 评分结果
export interface AIScoreDetail {
  relevance: number;
  quality: number;
  freshness: number;
  uniqueness: number;
  usability: number;
}

// AI 素材卡
export interface MaterialCard {
  id: string;
  contentItemId: string;
  cardType: CardType;
  title: string;
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
  verificationNotes: string | null;
  markdownContent: string | null;
  userEditedContent: string | null;
  confirmed: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 同步记录
export interface SyncRecord {
  id: string;
  materialCardId: string;
  contentItemId: string;
  documentRole: DocumentRole;
  regionFolder: string | null;
  typeFolder: string | null;
  targetRemoteId: string | null;
  remoteDocumentId: string | null;
  status: SyncStatus;
  errorCode: string | null;
  errorMessage: string | null;
  syncedAt: Date;
}

// 采集运行记录
export interface CollectorRun {
  id: string;
  sourceId: string;
  collectorType: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: CollectorStatus;
  discoveredCount: number;
  importedCount: number;
  errorSummary: string | null;
  evidencePath: string | null;
}

// P0-2: AI 配置
export interface AiConfig {
  id: string;
  name: string;
  baseUrl: string;
  encryptedKey: string;
  model: string;
  temperature: number;
  isEnabled: boolean;
  lastTestedAt: Date | null;
  lastTestError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 扩展接口 ====================

export interface ContentItemWithCards extends ContentItem {
  materialCards: MaterialCard[];
  source?: { id: string; name: string; platform: Platform };
}

export interface MaterialCardWithSync extends MaterialCard {
  syncRecords: SyncRecord[];
  contentItem?: ContentItem;
}

export interface SourceWithRuns extends Source {
  collectorRuns: CollectorRun[];
  collectionChannels?: CollectionChannel[];
  _count?: { contentItems: number };
}

// ==================== 工具类型 ====================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MaterialCardForm {
  title: string;
  cardType: CardType;
  originalFacts?: string;
  aiSummary?: string;
  highlightSuggestions?: string;
  transferSuggestions?: string;
  verificationNotes?: string;
  markdownContent?: string;
  userEditedContent?: string;
  confirmed?: boolean;
}

export interface ContentCollectForm {
  url: string;
  sourceId?: string;
  contentType?: ContentType;
  trustLevel?: TrustLevel;
  topicTags?: string[];
  regionScopes?: string[];
}

// AI 生成的结构化素材内容（用于 ima 同步格式化）
export interface MaterialCardStructuredContent {
  mainPoint: string;
  structure: {
    background: string;
    problem: string;
    cause: string;
    solution: string;
    sublimation: string;
  };
  standardExpressions: string[];
  cases: string[];
  provinceRelevance: {
    guangdong: string;
    hunan: string;
  };
  applicableTypes: string[];
  writingExercise: string;
}
