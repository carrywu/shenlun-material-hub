// 申论素材采集台 类型定义 v2

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

// 处理状态（8 种）
export const PROCESSING_STATUSES = [
  "pending",              // 待处理
  "fetched",              // 已抓取
  "parsed",               // 已解析
  "analyzing",            // 分析中
  "card_generated",       // 卡片已生成
  "card_edited",          // 卡片已编辑
  "confirmed",            // 已确认
  "synced",               // 已同步
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

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
export const COLLECTOR_STATUSES = ["running", "success", "failed"] as const;
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
  regionScopes: string[];       // JSON 数组
  baseUrl: string | null;
  profileUrl: string | null;
  priority: Priority;
  collectionMode: string | null;
  isEnabled: boolean;
  verificationStatus: VerificationStatus;
  keywords: string[];           // JSON 数组
  collectionFrequency: string | null;
  lastCollectedAt: Date | null;
  lastError: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 内容条目
export interface ContentItem {
  id: string;
  sourceId: string;
  externalContentId: string | null;
  platform: Platform;
  contentType: ContentType;
  trustLevel: TrustLevel;
  title: string;
  authorOrAccount: string | null;
  originalUrl: string;
  publishedAt: Date | null;
  section: string | null;
  regionScopes: string[];       // JSON 数组
  topicTags: string[];          // JSON 数组
  excerpt: string | null;
  recommendationReason: string | null;
  verificationStatus: VerificationStatus;
  processingStatus: ProcessingStatus;
  discoveryChannel: string | null;
  fullTextStored: boolean;
  fullText: string | null;
  contentHash: string | null;
  linkedOriginalId: string | null;
  createdAt: Date;
  updatedAt: Date;
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

// ==================== 扩展接口 ====================

// 带关联数据的内容条目
export interface ContentItemWithCards extends ContentItem {
  materialCards: MaterialCard[];
  source?: { id: string; name: string; platform: Platform };
}

// 带同步记录的素材卡
export interface MaterialCardWithSync extends MaterialCard {
  syncRecords: SyncRecord[];
  contentItem?: ContentItem;
}

// 带采集记录的源
export interface SourceWithRuns extends Source {
  collectorRuns: CollectorRun[];
  _count?: { contentItems: number };
}

// ==================== 工具类型 ====================

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 素材卡编辑表单
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

// 内容采集表单
export interface ContentCollectForm {
  url: string;
  sourceId?: string;
  contentType?: ContentType;
  trustLevel?: TrustLevel;
  topicTags?: string[];
  regionScopes?: string[];
}

// AI 生成的结构化素材内容
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
