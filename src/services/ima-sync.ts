import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { MaterialCardStructuredContent } from "@/types";

// IMA API 基础 URL（非敏感，用于构造请求地址）
const DEFAULT_IMA_API_BASE = "https://api.ima.qq.com";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface ImaConfig {
  baseUrl: string;
  clientId: string;
  apiKey: string;
  knowledgeBaseId: string;
}

/**
 * 解析 IMA 配置：必须从数据库 ImaTarget 表读取用户配置，无配置时抛出错误。
 * 不使用环境变量 fallback，确保每个用户只同步到自己的知识库。
 */
export async function resolveImaConfig(userId?: string): Promise<ImaConfig> {
  if (userId) {
    const target = await db.imaTarget.findFirst({
      where: { userId, isEnabled: true },
      orderBy: { updatedAt: "desc" },
    });

    if (target) {
      return {
        baseUrl: target.baseUrl || DEFAULT_IMA_API_BASE,
        clientId: target.clientId ?? "",
        apiKey: target.encryptedApiKey ? decrypt(target.encryptedApiKey) : "",
        knowledgeBaseId: target.knowledgeBaseId ?? "",
      };
    }
  }

  // 无用户配置，抛出业务错误
  throw new Error("IMA_CONFIG_MISSING: 请先在设置中配置个人 IMA 知识库");
}

interface ImaDocument {
  title: string;
  content: string;
  metadata?: Record<string, string>;
}

interface ImaSyncResult {
  knowledgeBaseId: string;
  documentId: string;
}

export type ImaSyncItemStatus = "success" | "failed" | "skipped";

export interface ImaSyncItemResult {
  materialCardId: string;
  status: ImaSyncItemStatus;
  syncRecordId?: string;
  imaDocumentId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ImaBatchSyncResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  items: ImaSyncItemResult[];
}

export interface ImaHealthResult {
  configured: boolean;
  reachable: boolean;
  authValid: boolean;
  workspace?: string;
  lastCheckedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ImaArticleSyncResult {
  success: boolean;
  sourceType: "article" | "material-card";
  imaDocumentId?: string;
  syncedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
}

class ImaSyncError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ImaSyncError";
  }
}

function normalizeImaError(error: unknown): { errorCode: string; errorMessage: string } {
  if (error instanceof ImaSyncError) {
    return { errorCode: error.code, errorMessage: error.message };
  }
  if (error instanceof Error) {
    if (error.message.startsWith("IMA_CONFIG_MISSING")) {
      return {
        errorCode: "IMA_CONFIG_MISSING",
        errorMessage: error.message.replace(/^IMA_CONFIG_MISSING:\s*/, ""),
      };
    }
    return { errorCode: "IMA_SYNC_FAILED", errorMessage: error.message };
  }
  return { errorCode: "IMA_SYNC_FAILED", errorMessage: "同步失败" };
}

function logImaOperation(
  level: "info" | "error",
  detail: Record<string, unknown>
) {
  const payload = {
    requestId: detail.requestId ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...detail,
  };
  if (level === "error") {
    console.error("[IMA]", payload);
  } else {
    console.info("[IMA]", payload);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCardContent(
  title: string,
  content: string,
  cardType: string,
  topicTags: string
): ImaDocument {
  let parsed: MaterialCardStructuredContent | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // content is not JSON, use raw
  }

  const sections: string[] = [];
  sections.push(`# ${title}`);
  sections.push(`类型：${cardType}`);
  if (topicTags) sections.push(`标签：${topicTags}`);
  sections.push("");

  if (parsed) {
    sections.push(`## 核心主旨\n${parsed.mainPoint}`);
    sections.push("");
    sections.push("## 结构分析");
    sections.push(`- 背景：${parsed.structure.background}`);
    sections.push(`- 问题：${parsed.structure.problem}`);
    sections.push(`- 原因：${parsed.structure.cause}`);
    sections.push(`- 对策：${parsed.structure.solution}`);
    sections.push(`- 升华：${parsed.structure.sublimation}`);
    sections.push("");
    if (parsed.standardExpressions.length > 0) {
      sections.push("## 规范表达");
      parsed.standardExpressions.forEach((expr: string) => sections.push(`- ${expr}`));
      sections.push("");
    }
    if (parsed.cases.length > 0) {
      sections.push("## 案例");
      parsed.cases.forEach((c: string) => sections.push(`- ${c}`));
      sections.push("");
    }
    sections.push("## 省情关联");
    sections.push(`- 广东：${parsed.provinceRelevance.guangdong}`);
    sections.push(`- 湖南：${parsed.provinceRelevance.hunan}`);
    sections.push("");
    if (parsed.applicableTypes.length > 0) {
      sections.push("## 适用题型");
      parsed.applicableTypes.forEach((t: string) => sections.push(`- ${t}`));
      sections.push("");
    }
    sections.push(`## 仿写练习\n${parsed.writingExercise}`);
  } else {
    sections.push(content);
  }

  return {
    title,
    content: sections.join("\n"),
    metadata: { cardType, topicTags },
  };
}

function formatArticleContent(item: {
  title: string;
  fullText: string | null;
  excerpt: string | null;
  originalUrl: string;
  topicTags: string | null;
}): ImaDocument {
  const sections = [`# ${item.title}`, ""];
  if (item.originalUrl) sections.push(`原文链接：${item.originalUrl}`, "");
  if (item.excerpt) sections.push(`## 摘要\n${item.excerpt}`, "");
  sections.push("## 正文");
  sections.push(item.fullText ?? item.excerpt ?? "");

  return {
    title: item.title,
    content: sections.join("\n"),
    metadata: {
      sourceType: "article",
      originalUrl: item.originalUrl,
      topicTags: item.topicTags ?? "[]",
    },
  };
}

async function callImaApi(
  endpoint: string,
  method: string,
  body?: unknown,
  config?: ImaConfig
): Promise<unknown> {
  const baseUrl = config?.baseUrl ?? DEFAULT_IMA_API_BASE;
  const clientId = config?.clientId ?? "";
  const apiKey = config?.apiKey ?? "";
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
    Authorization: `Bearer ${apiKey}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    const code = res.status === 401 || res.status === 403 ? "IMA_AUTH_FAILED" : "IMA_API_ERROR";
    throw new ImaSyncError(code, `IMA API 错误（${res.status}）：${errorText}`, res.status);
  }

  return res.json();
}

async function uploadDocument(
  doc: ImaDocument,
  config?: ImaConfig
): Promise<ImaSyncResult> {
  const kbId = config?.knowledgeBaseId ?? "";
  const result = (await callImaApi(
    `/v1/knowledge_bases/${kbId}/documents`,
    "POST",
    {
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
    },
    config
  )) as { document_id: string };

  return {
    knowledgeBaseId: kbId,
    documentId: result.document_id,
  };
}

async function uploadDocumentWithRetry(
  doc: ImaDocument,
  config?: ImaConfig
): Promise<ImaSyncResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await uploadDocument(doc, config);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error("同步失败");
}

const CARD_TYPE_FOLDER_MAP: Record<string, string> = {
  fact_summary: "案例素材",
  argument_analysis: "论点分析",
  data_highlight: "案例素材",
  policy_compare: "政策对比",
  case_study: "案例研究",
};

function deriveFolders(contentItem: { regionScopes: string | null }, cardType: string) {
  let regionFolder: string | null = null;
  if (contentItem.regionScopes) {
    try {
      const scopes: string[] = JSON.parse(contentItem.regionScopes);
      if (scopes.length > 0) regionFolder = scopes.join("/");
    } catch {
      // ignore parse error
    }
  }
  const typeFolder = CARD_TYPE_FOLDER_MAP[cardType] ?? cardType;
  return { regionFolder, typeFolder };
}

export async function syncToIma(
  cardId: string,
  userId?: string
): Promise<{ success: boolean; syncRecordId: string; error?: string }> {
  const result = await ImaService.syncMaterialCard({ materialCardId: cardId, userId });
  return {
    success: result.status !== "failed",
    syncRecordId: result.syncRecordId ?? "",
    error: result.errorMessage,
  };
}

async function syncMaterialCard(params: {
  materialCardId: string;
  userId?: string;
  requestId?: string;
}): Promise<ImaSyncItemResult> {
  const { materialCardId, userId, requestId = crypto.randomUUID() } = params;
  const startedAt = Date.now();
  const card = await db.materialCard.findUnique({
    where: { id: materialCardId },
    include: {
      contentItem: { select: { id: true, title: true, topicTags: true, regionScopes: true } },
    },
  });

  if (!card) {
    return {
      materialCardId,
      status: "failed",
      errorCode: "MATERIAL_CARD_NOT_FOUND",
      errorMessage: "素材卡不存在",
    };
  }

  if (!card.confirmed) {
    return {
      materialCardId,
      status: "failed",
      errorCode: "MATERIAL_CARD_UNCONFIRMED",
      errorMessage: "素材卡尚未确认，请先确认后再同步",
    };
  }

  const { regionFolder, typeFolder } = deriveFolders(card.contentItem, card.cardType);
  let syncRecord: { id: string } | null = null;

  try {
    const config = await resolveImaConfig(userId);
    const existingSuccess = await db.syncRecord.findFirst({
      where: {
        materialCardId,
        userId: userId ?? null,
        documentRole: "material_card",
        status: "success",
      },
      orderBy: { syncedAt: "desc" },
    });

    if (existingSuccess) {
      logImaOperation("info", {
        requestId,
        operation: "syncMaterialCard",
        status: "skipped",
        cardId: materialCardId,
        userId,
        duration: Date.now() - startedAt,
      });
      return {
        materialCardId,
        status: "skipped",
        syncRecordId: existingSuccess.id,
        imaDocumentId: existingSuccess.remoteDocumentId ?? undefined,
      };
    }

    syncRecord = await db.syncRecord.create({
      data: {
        materialCardId,
        contentItemId: card.contentItemId,
        documentRole: "material_card",
        regionFolder,
        typeFolder,
        status: "pending",
        userId: userId ?? null,
      },
    });

    const displayContent = card.userEditedContent ?? card.markdownContent ?? card.aiSummary ?? "";
    const topicTags = card.contentItem?.topicTags ?? "[]";
    let parsedTags: string;
    try {
      parsedTags = JSON.parse(topicTags).join(",");
    } catch {
      parsedTags = topicTags;
    }

    const doc = formatCardContent(
      card.title,
      displayContent,
      card.cardType,
      parsedTags
    );

    const result = await uploadDocumentWithRetry(doc, config);

    await db.syncRecord.update({
      where: { id: syncRecord.id },
      data: {
        status: "success",
        targetRemoteId: result.knowledgeBaseId,
        remoteDocumentId: result.documentId,
      },
    });

    logImaOperation("info", {
      requestId,
      operation: "syncMaterialCard",
      status: "success",
      cardId: materialCardId,
      userId,
      imaConfigId: config.knowledgeBaseId,
      duration: Date.now() - startedAt,
    });

    return {
      materialCardId,
      status: "success",
      syncRecordId: syncRecord.id,
      imaDocumentId: result.documentId,
    };
  } catch (error) {
    const { errorCode, errorMessage } = normalizeImaError(error);

    if (syncRecord) {
      await db.syncRecord.update({
        where: { id: syncRecord.id },
        data: {
          status: "failed",
          errorCode,
          errorMessage,
        },
      });
    }

    logImaOperation("error", {
      requestId,
      operation: "syncMaterialCard",
      status: "failed",
      cardId: materialCardId,
      userId,
      duration: Date.now() - startedAt,
      errorCode,
      errorMessage,
    });

    return {
      materialCardId,
      status: "failed",
      syncRecordId: syncRecord?.id,
      errorCode,
      errorMessage,
    };
  }
}

export async function syncBatchToIma(
  cardIds: string[],
  concurrency: number = 3,
  userId?: string
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    cardId: string;
    success: boolean;
    syncRecordId?: string;
    error?: string;
  }>;
}> {
  const result = await ImaService.batchSyncMaterialCards({
    materialCardIds: cardIds,
    concurrency,
    userId,
  });
  const results = result.items.map((item) => ({
    cardId: item.materialCardId,
    success: item.status !== "failed",
    syncRecordId: item.syncRecordId,
    error: item.errorMessage,
  }));
  return {
    total: result.total,
    success: result.success + result.skipped,
    failed: result.failed,
    results,
  };
}

async function batchSyncMaterialCards(params: {
  materialCardIds: string[];
  concurrency?: number;
  userId?: string;
  requestId?: string;
}): Promise<ImaBatchSyncResult> {
  const { materialCardIds, concurrency = 3, userId, requestId = crypto.randomUUID() } = params;
  const items: ImaSyncItemResult[] = [];

  for (let i = 0; i < materialCardIds.length; i += concurrency) {
    const batch = materialCardIds.slice(i, i + concurrency);
    const batchItems = await Promise.all(
      batch.map((materialCardId) =>
        syncMaterialCard({ materialCardId, userId, requestId })
      )
    );
    items.push(...batchItems);
  }

  return {
    total: items.length,
    success: items.filter((item) => item.status === "success").length,
    failed: items.filter((item) => item.status === "failed").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    items,
  };
}

async function healthCheck(userId: string): Promise<ImaHealthResult> {
  const lastCheckedAt = new Date().toISOString();
  try {
    const config = await resolveImaConfig(userId);
    const res = await fetch(`${config.baseUrl}/v1/knowledge_bases/${config.knowledgeBaseId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": config.clientId,
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!res.ok) {
      const errorMessage = await res.text().catch(() => "连接检查失败");
      return {
        configured: true,
        reachable: res.status !== 0,
        authValid: res.status !== 401 && res.status !== 403,
        workspace: config.knowledgeBaseId,
        lastCheckedAt,
        errorCode: res.status === 401 || res.status === 403 ? "IMA_AUTH_FAILED" : "IMA_HEALTH_FAILED",
        errorMessage,
      };
    }

    return {
      configured: true,
      reachable: true,
      authValid: true,
      workspace: config.knowledgeBaseId,
      lastCheckedAt,
    };
  } catch (error) {
    const { errorCode, errorMessage } = normalizeImaError(error);
    return {
      configured: errorCode !== "IMA_CONFIG_MISSING",
      reachable: false,
      authValid: false,
      lastCheckedAt,
      errorCode,
      errorMessage,
    };
  }
}

async function syncArticle(params: {
  articleId: string;
  userId: string;
  requestId?: string;
}): Promise<ImaArticleSyncResult> {
  const { articleId, userId, requestId = crypto.randomUUID() } = params;
  const startedAt = Date.now();
  const item = await db.contentItem.findUnique({
    where: { id: articleId },
    include: {
      materialCards: {
        where: { confirmed: true },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      },
    },
  });

  if (!item) {
    return {
      success: false,
      sourceType: "article",
      errorCode: "ARTICLE_NOT_FOUND",
      errorMessage: "文章不存在",
    };
  }

  const confirmedCardIds = item.materialCards.map((card) => card.id);
  if (confirmedCardIds.length > 0) {
    const result = await batchSyncMaterialCards({
      materialCardIds: confirmedCardIds,
      userId,
      requestId,
    });
    const firstSynced = result.items.find((entry) => entry.status === "success" || entry.status === "skipped");
    return {
      success: result.failed === 0,
      sourceType: "material-card",
      imaDocumentId: firstSynced?.imaDocumentId,
      syncedAt: new Date().toISOString(),
      errorCode: result.failed > 0 ? "IMA_BATCH_PARTIAL_FAILED" : undefined,
      errorMessage: result.failed > 0 ? `成功 ${result.success + result.skipped} 条，失败 ${result.failed} 条` : undefined,
    };
  }

  if (item.adminReviewStatus !== "approved") {
    return {
      success: false,
      sourceType: "article",
      errorCode: "ARTICLE_NOT_APPROVED",
      errorMessage: "文章尚未通过审核，无法同步正文",
    };
  }

  const content = item.fullText ?? item.excerpt ?? "";
  if (!content.trim()) {
    return {
      success: false,
      sourceType: "article",
      errorCode: "ARTICLE_CONTENT_EMPTY",
      errorMessage: "文章正文为空，无法同步",
    };
  }

  let syncRecord: { id: string } | null = null;
  try {
    const config = await resolveImaConfig(userId);
    const existingSuccess = await db.syncRecord.findFirst({
      where: {
        materialCardId: null,
        contentItemId: articleId,
        userId,
        documentRole: "original_archive",
        status: "success",
      },
      orderBy: { syncedAt: "desc" },
    });

    if (existingSuccess) {
      return {
        success: true,
        sourceType: "article",
        imaDocumentId: existingSuccess.remoteDocumentId ?? undefined,
        syncedAt: new Date().toISOString(),
        message: "当前文章内容此前已同步，已跳过重复创建",
      };
    }

    syncRecord = await db.syncRecord.create({
      data: {
        materialCardId: null,
        contentItemId: articleId,
        documentRole: "original_archive",
        status: "pending",
        userId,
      },
    });

    const doc = formatArticleContent(item);
    const result = await uploadDocumentWithRetry(doc, config);

    await db.syncRecord.update({
      where: { id: syncRecord.id },
      data: {
        status: "success",
        targetRemoteId: result.knowledgeBaseId,
        remoteDocumentId: result.documentId,
      },
    });

    logImaOperation("info", {
      requestId,
      operation: "syncArticle",
      status: "success",
      articleId,
      userId,
      imaConfigId: config.knowledgeBaseId,
      duration: Date.now() - startedAt,
    });

    return {
      success: true,
      sourceType: "article",
      imaDocumentId: result.documentId,
      syncedAt: new Date().toISOString(),
      message: "当前文章尚未生成素材卡，已同步文章内容",
    };
  } catch (error) {
    const { errorCode, errorMessage } = normalizeImaError(error);
    if (syncRecord) {
      await db.syncRecord.update({
        where: { id: syncRecord.id },
        data: { status: "failed", errorCode, errorMessage },
      });
    }
    logImaOperation("error", {
      requestId,
      operation: "syncArticle",
      status: "failed",
      articleId,
      userId,
      duration: Date.now() - startedAt,
      errorCode,
      errorMessage,
    });
    return {
      success: false,
      sourceType: "article",
      errorCode,
      errorMessage,
    };
  }
}

export const ImaService = {
  syncMaterialCard,
  batchSyncMaterialCards,
  syncArticle,
  healthCheck,
};

export async function getSyncStatus(syncRecordId: string) {
  const record = await db.syncRecord.findUnique({
    where: { id: syncRecordId },
    include: {
      materialCard: {
        select: { id: true, title: true },
      },
    },
  });

  if (!record) {
    throw new Error("同步记录不存在");
  }

  return record;
}

export async function getSyncHistory(
  cardId: string,
  limit: number = 20
) {
  return db.syncRecord.findMany({
    where: { materialCardId: cardId },
    orderBy: { syncedAt: "desc" },
    take: limit,
  });
}

export interface SyncRecordsQuery {
  status?: string;
  documentRole?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  extraWhere?: Record<string, unknown>;
}

export async function getSyncRecords(query: SyncRecordsQuery) {
  const { status, documentRole, dateFrom, dateTo, page = 1, pageSize = 20, extraWhere } = query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (documentRole) where.documentRole = documentRole;
  if (dateFrom || dateTo) {
    where.syncedAt = {} as Record<string, Date>;
    if (dateFrom) (where.syncedAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) (where.syncedAt as Record<string, Date>).lte = new Date(dateTo);
  }

  // Merge any additional where conditions (e.g. data isolation filters)
  const mergedWhere = { ...where, ...extraWhere };

  const [data, total] = await Promise.all([
    db.syncRecord.findMany({
      where: mergedWhere,
      include: {
        materialCard: { select: { id: true, title: true, cardType: true, confirmed: true } },
      },
      orderBy: { syncedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.syncRecord.count({ where: mergedWhere }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
