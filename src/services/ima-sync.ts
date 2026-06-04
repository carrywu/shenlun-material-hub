import { db } from "@/lib/db";
import type { MaterialCardStructuredContent } from "@/types";

const IMA_API_BASE = process.env.IMA_API_BASE ?? "https://api.ima.qq.com";
const IMA_CLIENT_ID = process.env.IMA_CLIENT_ID ?? "";
const IMA_API_KEY = process.env.IMA_API_KEY ?? "";
const IMA_KNOWLEDGE_BASE_ID = process.env.IMA_KNOWLEDGE_BASE_ID ?? "";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface ImaDocument {
  title: string;
  content: string;
  metadata?: Record<string, string>;
}

interface ImaSyncResult {
  knowledgeBaseId: string;
  documentId: string;
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

async function callImaApi(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const url = `${IMA_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Id": IMA_CLIENT_ID,
    Authorization: `Bearer ${IMA_API_KEY}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`ima API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

async function uploadDocument(
  doc: ImaDocument
): Promise<ImaSyncResult> {
  const result = (await callImaApi(
    `/v1/knowledge_bases/${IMA_KNOWLEDGE_BASE_ID}/documents`,
    "POST",
    {
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
    }
  )) as { document_id: string };

  return {
    knowledgeBaseId: IMA_KNOWLEDGE_BASE_ID,
    documentId: result.document_id,
  };
}

async function uploadDocumentWithRetry(
  doc: ImaDocument
): Promise<ImaSyncResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await uploadDocument(doc);
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
  cardId: string
): Promise<{ success: boolean; syncRecordId: string; error?: string }> {
  const card = await db.materialCard.findUnique({
    where: { id: cardId },
    include: {
      contentItem: { select: { id: true, title: true, topicTags: true, regionScopes: true } },
    },
  });

  if (!card) {
    throw new Error("素材卡不存在");
  }

  if (!card.confirmed) {
    throw new Error("素材卡尚未确认，请先确认后再同步");
  }

  const { regionFolder, typeFolder } = deriveFolders(card.contentItem, card.cardType);

  const syncRecord = await db.syncRecord.create({
    data: {
      materialCardId: cardId,
      contentItemId: card.contentItemId,
      documentRole: "material_card",
      regionFolder,
      typeFolder,
      status: "pending",
    },
  });

  try {
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

    const result = await uploadDocumentWithRetry(doc);

    await db.syncRecord.update({
      where: { id: syncRecord.id },
      data: {
        status: "success",
        targetRemoteId: result.knowledgeBaseId,
        remoteDocumentId: result.documentId,
      },
    });

    return { success: true, syncRecordId: syncRecord.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "同步失败";

    await db.syncRecord.update({
      where: { id: syncRecord.id },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return {
      success: false,
      syncRecordId: syncRecord.id,
      error: errorMessage,
    };
  }
}

export async function syncBatchToIma(
  cardIds: string[],
  concurrency: number = 3
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
  const results: Array<{
    cardId: string;
    success: boolean;
    syncRecordId?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < cardIds.length; i += concurrency) {
    const batch = cardIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (cardId) => {
        try {
          const result = await syncToIma(cardId);
          return {
            cardId,
            success: result.success,
            syncRecordId: result.syncRecordId,
            error: result.error,
          };
        } catch (error) {
          return {
            cardId,
            success: false,
            error: error instanceof Error ? error.message : "同步失败",
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return {
    total: results.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

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
}

export async function getSyncRecords(query: SyncRecordsQuery) {
  const { status, documentRole, dateFrom, dateTo, page = 1, pageSize = 20 } = query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (documentRole) where.documentRole = documentRole;
  if (dateFrom || dateTo) {
    where.syncedAt = {} as Record<string, Date>;
    if (dateFrom) (where.syncedAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) (where.syncedAt as Record<string, Date>).lte = new Date(dateTo);
  }

  const [data, total] = await Promise.all([
    db.syncRecord.findMany({
      where,
      include: {
        materialCard: { select: { id: true, title: true, cardType: true, confirmed: true } },
      },
      orderBy: { syncedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.syncRecord.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
