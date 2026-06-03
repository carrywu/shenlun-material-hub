import OpenAI from "openai";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { CardType, AIScoreDetail, ContentGenre, AiDecision, ErrorCode } from "@/types";

export type AiRuntimeSource = "db" | "env";

export interface AiRuntime {
  client: OpenAI;
  model: string;
  source: AiRuntimeSource;
  baseURL?: string;
  keySuffix: string;
  cacheKey: string;
}

export interface AiErrorDiagnostics {
  status?: number;
  source?: AiRuntimeSource;
  baseURL?: string;
  model?: string;
  keySuffix?: string;
  cacheKey?: string;
  providerMessage?: string;
}

export class AiServiceError extends Error {
  code: ErrorCode;
  status?: number;
  diagnostics?: AiErrorDiagnostics;

  constructor(
    code: ErrorCode,
    message: string,
    status?: number,
    diagnostics?: AiErrorDiagnostics
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.diagnostics = diagnostics;
    this.name = "AiServiceError";
  }
}

let cachedRuntime: AiRuntime | null = null;

/**
 * 清除 AI 配置缓存（配置更新后调用）。
 * getAiRuntime 同时使用配置版本 cacheKey 自动换 client；reset 只是让 POST/DELETE 后立即生效。
 */
export function resetAiConfigCache(): void {
  cachedRuntime = null;
}

function trimConfigValue(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function keySuffix(apiKey: string): string {
  const trimmed = apiKey.trim();
  const suffix = trimmed.slice(-4).padStart(Math.min(trimmed.length, 4), "*");
  return `****${suffix}`;
}

function envHash(apiKey: string, baseURL: string | undefined, model: string): string {
  return createHash("sha256")
    .update([apiKey, baseURL ?? "", model].join("\0"))
    .digest("hex")
    .slice(0, 16);
}

async function resolveAiRuntimeConfig(): Promise<{
  apiKey: string;
  model: string;
  source: AiRuntimeSource;
  baseURL?: string;
  cacheKey: string;
}> {
  try {
    const config = await db.aiConfig.findFirst({
      where: { name: "default", isEnabled: true },
      select: {
        id: true,
        encryptedKey: true,
        baseUrl: true,
        model: true,
        updatedAt: true,
      },
    });

    if (config) {
      if (!process.env.AI_CONFIG_ENCRYPTION_KEY) {
        throw new AiServiceError(
          "AI_ENCRYPTION_KEY_MISSING",
          "AI_CONFIG_ENCRYPTION_KEY 环境变量未设置，无法解密数据库中的 API Key",
          500,
          { source: "db" }
        );
      }

      let apiKey: string;
      try {
        apiKey = decrypt(config.encryptedKey);
      } catch {
        throw new AiServiceError(
          "AI_CONFIG_DECRYPT_FAILED",
          "数据库中的 AI 配置解密失败，可能是密钥不匹配。请删除旧配置后重新保存",
          500,
          { source: "db", baseURL: config.baseUrl, model: config.model }
        );
      }

      const trimmedApiKey = trimConfigValue(apiKey);
      if (!trimmedApiKey) {
        throw new AiServiceError(
          "AI_CONFIG_MISSING",
          "数据库 AI 配置中的 API Key 为空，请重新保存配置",
          500,
          { source: "db", baseURL: config.baseUrl, model: config.model }
        );
      }

      return {
        apiKey: trimmedApiKey,
        model: trimConfigValue(config.model) ?? "gpt-4o",
        source: "db",
        baseURL: trimConfigValue(config.baseUrl),
        cacheKey: `db:${config.id}:${config.updatedAt.toISOString()}`,
      };
    }
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    // 数据库读取失败时按既有行为降级到环境变量，避免 DB 暂时不可用导致所有 AI 功能不可用。
  }

  const envApiKey = trimConfigValue(process.env.AI_API_KEY) ?? trimConfigValue(process.env.OPENAI_API_KEY);
  const envBaseURL = trimConfigValue(process.env.AI_BASE_URL);
  const envModel = trimConfigValue(process.env.AI_MODEL) ?? trimConfigValue(process.env.OPENAI_MODEL) ?? "gpt-4o";

  if (!envApiKey) {
    throw new AiServiceError(
      "AI_CONFIG_MISSING",
      "未找到 AI 配置：数据库无启用配置且环境变量 AI_API_KEY / OPENAI_API_KEY 未设置",
      500,
      { source: "env", baseURL: envBaseURL, model: envModel }
    );
  }

  return {
    apiKey: envApiKey,
    model: envModel,
    source: "env",
    baseURL: envBaseURL,
    cacheKey: `env:${envHash(envApiKey, envBaseURL, envModel)}`,
  };
}

export async function getAiRuntime(): Promise<AiRuntime> {
  const config = await resolveAiRuntimeConfig();

  if (cachedRuntime?.cacheKey === config.cacheKey) {
    return cachedRuntime;
  }

  cachedRuntime = {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    }),
    model: config.model,
    source: config.source,
    baseURL: config.baseURL,
    keySuffix: keySuffix(config.apiKey),
    cacheKey: config.cacheKey,
  };

  return cachedRuntime;
}

export async function getOpenAI(): Promise<{ openai: OpenAI; model: string }> {
  const runtime = await getAiRuntime();
  return { openai: runtime.client, model: runtime.model };
}

async function getTemperature(): Promise<number> {
  try {
    const config = await db.aiConfig.findFirst({
      where: { name: "default", isEnabled: true },
      select: { temperature: true },
    });
    if (config) return config.temperature;
  } catch {
    // ignore
  }
  return 0.3;
}

function safeProviderMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.replace(/(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+)/g, "[redacted]");
}

function providerStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isInteger(status) ? status : undefined;
  }
  return undefined;
}

function aiRequestError(error: unknown, runtime: AiRuntime): AiServiceError {
  const status = providerStatus(error);
  return new AiServiceError(
    "AI_API_CALL_FAILED",
    "AI 请求失败",
    status ?? 502,
    {
      status,
      source: runtime.source,
      baseURL: runtime.baseURL,
      model: runtime.model,
      keySuffix: runtime.keySuffix,
      cacheKey: runtime.cacheKey,
      providerMessage: safeProviderMessage(error),
    }
  );
}

interface ChatCompletionLike {
  choices: Array<{ message?: { content?: string | null } | null }>;
}

async function createChatCompletion(
  runtime: AiRuntime,
  params: Parameters<OpenAI["chat"]["completions"]["create"]>[0]
): Promise<ChatCompletionLike> {
  try {
    return await runtime.client.chat.completions.create({ ...params, stream: false }) as ChatCompletionLike;
  } catch (error) {
    throw aiRequestError(error, runtime);
  }
}

function parseAiJson(rawJson: string, context: string): Record<string, unknown> {
  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    const jsonMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
      } catch {
        throw new AiServiceError("AI_RESPONSE_INVALID_JSON", `AI 返回的${context}中 JSON 格式无效`, 502);
      }
    }
    throw new AiServiceError("AI_RESPONSE_INVALID_JSON", `AI 返回的${context}JSON 格式无效`, 502);
  }
}

export function normalizeMaterialCardTextField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ==================== P0-6: AI 相关性评估 ====================

const RELEVANCE_SYSTEM_PROMPT = `你是一位资深的申论辅导专家。请判断以下文章是否适合作为申论备考素材。

你需要：
1. 判断文章体裁（contentGenre）
2. 决定是否接受（accept/reject）
3. 给出理由

**接受标准**：
- 评论文章、政策解读、案例实践 → 通常接受
- 普通新闻（仅报道事件无分析）、会议新闻、通知公告 → 拒绝
- 文章必须有实质性分析或观点，不能只是信息罗列

返回 JSON：
{
  "decision": "accept 或 reject",
  "contentGenre": "commentary / policy_interpretation / case_practice / ordinary_news / meeting_news / notice / other",
  "reason": "50字以内的判定理由",
  "categories": ["标签1", "标签2"],
  "usableFor": ["可用场景1", "可用场景2"],
  "summary": "100字以内的文章摘要（仅 accept 时填写）",
  "quotes": ["金句1", "金句2"]
}`;

export interface RelevanceResult {
  decision: AiDecision;
  contentGenre: ContentGenre;
  reason: string;
  categories: string[];
  usableFor: string[];
  summary: string;
  quotes: string[];
}

export async function assessRelevance(
  title: string,
  sourceName: string,
  content: string,
  contentType: string
): Promise<RelevanceResult> {
  const runtime = await getAiRuntime();
  const temperature = await getTemperature();

  const userPrompt = `请评估以下文章是否适合作为申论备考素材：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${content.slice(0, 4000)}`;

  const completion = await createChatCompletion(runtime, {
    model: runtime.model,
    messages: [
      { role: "system", content: RELEVANCE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效内容");
  }

  const data = JSON.parse(rawJson);

  return {
    decision: data.decision === "accept" ? "accept" : "reject",
    contentGenre: validateContentGenre(data.contentGenre),
    reason: String(data.reason || "").slice(0, 200),
    categories: Array.isArray(data.categories) ? data.categories.slice(0, 5) : [],
    usableFor: Array.isArray(data.usableFor) ? data.usableFor.slice(0, 5) : [],
    summary: String(data.summary || "").slice(0, 500),
    quotes: Array.isArray(data.quotes) ? data.quotes.slice(0, 5) : [],
  };
}

function validateContentGenre(genre: string): ContentGenre {
  const valid: ContentGenre[] = [
    "commentary",
    "policy_interpretation",
    "case_practice",
    "ordinary_news",
    "meeting_news",
    "notice",
    "other",
  ];
  return valid.includes(genre as ContentGenre) ? (genre as ContentGenre) : "other";
}

// ==================== AI 评分（旧版保留兼容）====================

export interface AIScoreResult {
  overall: number;
  detail: AIScoreDetail;
}

const SCORING_SYSTEM_PROMPT = `你是一位资深的申论辅导专家，擅长评估官方文章对申论备考的价值。
请对文章进行以下 5 个维度的评分（每项 1-10 分）：

1. relevance（与申论考试的相关度）：文章主题是否属于申论常考话题（政策、社会、经济、文化、生态等）
2. quality（内容质量）：数据是否准确、论证是否严密、是否有权威来源
3. freshness（时效性）：是否为近期热点、是否具有当下讨论价值
4. uniqueness（独特性/稀缺性）：是否有独到见解、是否为少见的优质素材
5. usability（可迁移使用程度）：是否可以在多个申论题目中迁移使用

返回 JSON：
{
  "relevance": 8,
  "quality": 7,
  "freshness": 9,
  "uniqueness": 6,
  "usability": 8,
  "reason": "简短说明评分理由（50字以内）"
}`;

export async function scoreContentItem(
  title: string,
  sourceName: string,
  content: string,
  contentType: string
): Promise<AIScoreResult> {
  const runtime = await getAiRuntime();

  const userPrompt = `请对以下文章进行评分：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${content.slice(0, 4000)}`;

  const completion = await createChatCompletion(runtime, {
    model: runtime.model,
    messages: [
      { role: "system", content: SCORING_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效内容");
  }

  const data = JSON.parse(rawJson);

  const dimensions: (keyof AIScoreDetail)[] = [
    "relevance",
    "quality",
    "freshness",
    "uniqueness",
    "usability",
  ];

  const detail: AIScoreDetail = {} as AIScoreDetail;
  for (const dim of dimensions) {
    const score = Number(data[dim]);
    if (isNaN(score) || score < 1 || score > 10) {
      detail[dim] = 5;
    } else {
      detail[dim] = Math.round(score);
    }
  }

  const weights: Record<keyof AIScoreDetail, number> = {
    relevance: 0.25,
    quality: 0.25,
    freshness: 0.15,
    uniqueness: 0.15,
    usability: 0.2,
  };

  let overall = 0;
  for (const dim of dimensions) {
    overall += detail[dim] * weights[dim];
  }
  overall = Math.round(overall * 10) / 10;

  return { overall, detail };
}

// ==================== 素材卡生成 ====================

const CARD_TYPE_PROMPTS: Record<CardType, string> = {
  fact_summary: `你是一位资深的申论辅导专家，擅长从官方文章中提炼核心事实。
请分析文章，提取关键事实和数据，生成事实摘要卡。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要（标题+来源+时间）",
  "originalFacts": "从文章中提取的原始关键事实，分条列出，保留具体数据",
  "aiSummary": "AI 对核心事实的精炼概括，200字以内",
  "highlightSuggestions": "值得高亮的关键数据点和事实要点",
  "transferSuggestions": "这些事实可迁移使用的申论话题和场景"
}`,

  argument_analysis: `你是一位资深的申论辅导专家，擅长分析论证逻辑。
请分析文章的论证结构，提取论点、论据和论证方法。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "文章的核心论点和支撑论据",
  "aiSummary": "论证逻辑的结构化分析",
  "highlightSuggestions": "值得重点关注的论证手法和修辞技巧",
  "transferSuggestions": "可迁移的论证模式和适用于哪些申论题型"
}`,

  data_highlight: `你是一位资深的申论辅导专家，擅长提炼数据亮点。
请从文章中提取所有数据、统计、比例等量化信息。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "文章中的所有数据点，标注出处和含义",
  "aiSummary": "数据背后反映的趋势和问题",
  "highlightSuggestions": "最具说服力的数据亮点及其使用场景",
  "transferSuggestions": "这些数据可支撑的论点和适用的申论话题"
}`,

  policy_compare: `你是一位资深的申论辅导专家，擅长政策对比分析。
请分析文章涉及的政策内容，提炼政策要点并进行对比分析。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "涉及的政策名称、核心内容、实施范围",
  "aiSummary": "政策的创新点和与既有政策的对比",
  "highlightSuggestions": "政策亮点和值得关注的实施细则",
  "transferSuggestions": "可迁移到其他政策话题的分析框架"
}`,

  case_study: `你是一位资深的申论辅导专家，擅长提炼案例素材。
请从文章中提取具体案例，分析其要素和可迁移价值。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "案例的核心要素：主体、行为、结果、影响",
  "aiSummary": "案例的典型意义和启示",
  "highlightSuggestions": "案例中值得引用的具体细节和数据",
  "transferSuggestions": "该案例可应用于哪些申论主题和题型"
}`,
};

export interface AIGeneratedCardData {
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
}

export async function generateCardForContentItem(
  title: string,
  sourceName: string,
  content: string,
  cardType: CardType
): Promise<AIGeneratedCardData> {
  const runtime = await getAiRuntime();
  const systemPrompt = CARD_TYPE_PROMPTS[cardType];

  const userPrompt = `请分析以下文章，生成素材卡：

【标题】${title}
【来源】${sourceName}
【正文】
${content.slice(0, 4000)}`;

  const completion = await createChatCompletion(runtime, {
    model: runtime.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效内容");
  }

  const data = parseAiJson(rawJson, "素材卡");

  if (!data.aiSummary) {
    throw new AiServiceError("AI_RESPONSE_INVALID_JSON", "AI 返回数据结构不完整，缺少必要字段 aiSummary", 502);
  }

  return {
    sourceSnapshot: normalizeMaterialCardTextField(data.sourceSnapshot),
    originalFacts: normalizeMaterialCardTextField(data.originalFacts),
    aiSummary: normalizeMaterialCardTextField(data.aiSummary),
    highlightSuggestions: normalizeMaterialCardTextField(data.highlightSuggestions),
    transferSuggestions: normalizeMaterialCardTextField(data.transferSuggestions),
  };
}

interface ContentItemForGeneration {
  id: string;
  title: string;
  sourceName: string;
  content: string;
  cardType: CardType;
}

interface GenerationResult {
  contentItemId: string;
  success: boolean;
  data?: AIGeneratedCardData;
  error?: string;
}

export async function generateBatchCards(
  items: ContentItemForGeneration[],
  concurrency: number = 3
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const data = await generateCardForContentItem(
            item.title,
            item.sourceName,
            item.content,
            item.cardType
          );
          return { contentItemId: item.id, success: true, data };
        } catch (error) {
          return {
            contentItemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : "生成失败",
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * 测试 AI 配置是否可用
 */
export async function testAiConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const runtime = await getAiRuntime();

    const completion = await createChatCompletion(runtime, {
      model: runtime.model,
      messages: [{ role: "user", content: "回复 OK" }],
      max_tokens: 50,
    });

    const message = completion.choices[0]?.message;
    const content = message?.content;
    const reasoning = (message as unknown as Record<string, unknown>)?.reasoning_content;
    return { success: !!(content || reasoning) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "测试失败",
    };
  }
}
