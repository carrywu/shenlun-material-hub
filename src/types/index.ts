// 文章来源
export type ArticleSource = "人民日报" | "新华社" | "光明日报" | "经济日报" | string;

// 素材分类
export type MaterialCategory = "政治" | "经济" | "社会" | "文化" | "生态" | string;

// 同步状态
export type SyncStatus = "pending" | "success" | "failed";

// 文章
export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  content: string;
  summary: string | null;
  category: string;
  tags: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 素材卡
export interface MaterialCard {
  id: string;
  articleId: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  excerpt: string | null;
  notes: string | null;
  confirmed: boolean;
  generationPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 同步记录
export interface SyncRecord {
  id: string;
  materialCardId: string;
  status: SyncStatus;
  imaKnowledgeBaseId: string | null;
  imaDocumentId: string | null;
  errorMessage: string | null;
  syncedAt: Date;
}

// 带关联数据的文章
export interface ArticleWithCards extends Article {
  materialCards: MaterialCard[];
}

// 带同步记录的素材卡
export interface MaterialCardWithSync extends MaterialCard {
  syncRecords: SyncRecord[];
}

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

// 文章采集表单
export interface ArticleCollectForm {
  url: string;
  source?: string;
  category?: string;
  tags?: string[];
}

// 素材卡结构化内容
export interface MaterialCardStructuredContent {
  mainPoint: string;                    // 一句话主旨
  structure: {
    background: string;                 // 背景
    problem: string;                    // 问题
    cause: string;                      // 原因
    solution: string;                   // 对策
    sublimation: string;               // 升华
  };
  standardExpressions: string[];        // 规范表达（3-5个）
  cases: string[];                      // 可用案例
  provinceRelevance: {
    guangdong: string;                  // 广东省情关联
    hunan: string;                      // 湖南省情关联
  };
  applicableTypes: string[];            // 适用题型
  writingExercise: string;             // 仿写练习提示
}

// 素材卡编辑表单
export interface MaterialCardForm {
  title: string;
  content: string;
  category: string;
  tags: string[];
  excerpt?: string;
  notes?: string;
  confirmed?: boolean;
}
