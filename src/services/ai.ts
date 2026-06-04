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

export function buildAiContent(content: string, maxLength = 4000): string {
  if (content.length <= maxLength) return content;

  const omission = "\n\n……中间内容已省略……\n\n";
  const availableLength = Math.max(0, maxLength - omission.length);
  const headLength = Math.floor(availableLength * 0.7);
  const tailLength = availableLength - headLength;

  return [
    content.slice(0, headLength),
    omission,
    content.slice(-tailLength),
  ].join("");
}

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
  const systemPrompt = renderPromptTemplate(await getPromptTemplate("article_evaluation"), {
    title,
    sourceName,
    contentType,
    content: buildAiContent(content),
  });

  const userPrompt = `请评估以下文章是否适合作为申论备考素材：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${buildAiContent(content)}`;

  const completion = await createChatCompletion(runtime, {
    model: runtime.model,
    messages: [
      { role: "system", content: systemPrompt },
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

/**
 * 带重试和超时的评估包装器。
 * 仅对瞬态错误（速率限制、网络错误、超时）重试，永久错误直接抛出。
 */
export async function assessRelevanceWithRetry(
  title: string,
  sourceName: string,
  content: string,
  contentType: string,
  options?: { maxRetries?: number; timeoutMs?: number }
): Promise<RelevanceResult> {
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const backoffDelays = [1000, 3000];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        assessRelevance(title, sourceName, content, contentType),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI 评估超时")), timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();

      // 永久错误不重试
      const isPermanent =
        msg.includes("api key") ||
        msg.includes("invalid") ||
        msg.includes("未配置") ||
        msg.includes("未返回有效内容");
      if (isPermanent || attempt === maxRetries) break;

      // 瞬态错误：等待后重试
      await new Promise((r) => setTimeout(r, backoffDelays[attempt] ?? 3000));
    }
  }

  throw lastError ?? new Error("AI 评估失败");
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
${buildAiContent(content)}`;

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
  golden_sentence: `你是一位资深的申论辅导专家，擅长提炼申论写作金句。
请从文章中提取可用于申论写作开头、结尾、分论点升华的金句和精彩表达。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要（标题+来源+时间）",
  "originalFacts": "文章中的原始金句，逐条列出，标注出处段落",
  "aiSummary": "这些金句的修辞特点和表达技巧分析",
  "highlightSuggestions": "最值得背诵的金句及其适用场景（开头/结尾/分论点）",
  "transferSuggestions": "这些金句可迁移使用的申论话题和写作场景"
}`,

  standard_expression: `你是一位资深的申论辅导专家，擅长提炼政府材料规范表达。
请从文章中提取政府材料中的规范表达、固定搭配和常用句式。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "规范表达逐条列出，标注原文语境",
  "aiSummary": "这些规范表达的使用场景和语体特点",
  "highlightSuggestions": "最常用、最值得掌握的规范表达",
  "transferSuggestions": "这些规范表达可替换的口语化表述，及适用的申论题型"
}`,

  case_material: `你是一位资深的申论辅导专家，擅长提炼治理案例素材。
请从文章中提取可引用的治理案例、地方实践和典型做法。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "案例核心要素：地区/主体、具体做法、成效数据、创新点",
  "aiSummary": "案例的典型意义和治理启示",
  "highlightSuggestions": "案例中值得引用的具体细节和数据",
  "transferSuggestions": "该案例可应用于哪些申论主题（如基层治理、乡村振兴、数字政府等）"
}`,

  countermeasure: `你是一位资深的申论辅导专家，擅长提炼对策表达。
请从文章中提取对策、措施、做法相关的表达，适用于对策题和议论文对策段。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "对策逐条列出，保留原文规范表述",
  "aiSummary": "对策的逻辑层次（制度/技术/宣传/监督等）",
  "highlightSuggestions": "最具操作性的对策表达",
  "transferSuggestions": "这些对策可迁移的话题和申论题型"
}`,

  problem_statement: `你是一位资深的申论辅导专家，擅长提炼问题表述。
请从文章中提取社会问题、治理难点的标准化表述。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "问题表述逐条列出，保留原文用语",
  "aiSummary": "问题的本质、影响范围和严重程度分析",
  "highlightSuggestions": "最精准、最有概括力的问题表述",
  "transferSuggestions": "这些问题表述可应用于哪些申论主题和写作场景"
}`,

  reason_analysis: `你是一位资深的申论辅导专家，擅长提炼原因分析表达。
请从文章中提取问题原因分析的相关表达。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "原因分析逐条列出（主观/客观、直接/根本等层次）",
  "aiSummary": "原因分析的逻辑框架和层次结构",
  "highlightSuggestions": "最值得学习的原因分析表达方式",
  "transferSuggestions": "这些原因分析可迁移的话题和申论题型"
}`,

  policy_expression: `你是一位资深的申论辅导专家，擅长提炼政策表述。
请从文章中提取政策、会议、文件中的规范说法和权威表述。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "政策表述逐条列出，标注政策名称和出处",
  "aiSummary": "政策的核心要义和关键变化",
  "highlightSuggestions": "最权威、最值得引用的政策表述",
  "transferSuggestions": "这些政策表述可应用于哪些申论话题"
}`,

  person_story: `你是一位资深的申论辅导专家，擅长提炼人物事迹素材。
请从文章中提取先进人物、基层干部、群众故事等人物素材。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "人物事迹核心要素：人物身份、具体事迹、精神品质、社会影响",
  "aiSummary": "人物事迹的时代意义和精神价值",
  "highlightSuggestions": "最感人、最有代表性的事迹细节",
  "transferSuggestions": "这些人物素材可应用于哪些申论主题（如奉献、担当、创新等）"
}`,

  article_structure: `你是一位资深的申论辅导专家，擅长分析文章框架结构。
请分析文章的整体结构，提炼可复用的文章框架、标题和分论点组织方式。

返回 JSON：
{
  "sourceSnapshot": "来源信息摘要",
  "originalFacts": "文章结构拆解：标题、开头方式、分论点数量和逻辑、结尾方式",
  "aiSummary": "文章结构的特点和写作技巧",
  "highlightSuggestions": "最值得借鉴的结构模式和标题句式",
  "transferSuggestions": "该框架可应用于哪些申论题型和话题"
}`,
};

export type PromptTemplateKey =
  | "article_evaluation"
  | "card_golden_sentence"
  | "card_standard_expression"
  | "card_case_material"
  | "card_countermeasure"
  | "card_problem_statement"
  | "card_reason_analysis"
  | "card_policy_expression"
  | "card_person_story"
  | "card_article_structure";

export const CARD_TYPE_PROMPT_KEYS: Record<CardType, PromptTemplateKey> = {
  golden_sentence: "card_golden_sentence",
  standard_expression: "card_standard_expression",
  case_material: "card_case_material",
  countermeasure: "card_countermeasure",
  problem_statement: "card_problem_statement",
  reason_analysis: "card_reason_analysis",
  policy_expression: "card_policy_expression",
  person_story: "card_person_story",
  article_structure: "card_article_structure",
};

export const DEFAULT_PROMPT_TEMPLATES: Record<PromptTemplateKey, string> = {
  article_evaluation: RELEVANCE_SYSTEM_PROMPT,
  card_golden_sentence: CARD_TYPE_PROMPTS.golden_sentence,
  card_standard_expression: CARD_TYPE_PROMPTS.standard_expression,
  card_case_material: CARD_TYPE_PROMPTS.case_material,
  card_countermeasure: CARD_TYPE_PROMPTS.countermeasure,
  card_problem_statement: CARD_TYPE_PROMPTS.problem_statement,
  card_reason_analysis: CARD_TYPE_PROMPTS.reason_analysis,
  card_policy_expression: CARD_TYPE_PROMPTS.policy_expression,
  card_person_story: CARD_TYPE_PROMPTS.person_story,
  card_article_structure: CARD_TYPE_PROMPTS.article_structure,
};

export const PROMPT_TEMPLATE_DEFINITIONS: Array<{
  key: PromptTemplateKey;
  name: string;
  description: string;
}> = [
  { key: "article_evaluation", name: "文章评估提示词", description: "判断文章是否适合作为申论素材" },
  { key: "card_golden_sentence", name: "申论金句提示词", description: "提炼可背诵和迁移的申论金句" },
  { key: "card_standard_expression", name: "规范词提示词", description: "提炼政府材料规范表达" },
  { key: "card_case_material", name: "案例素材提示词", description: "提炼治理案例、地方实践和典型做法" },
  { key: "card_countermeasure", name: "对策表达提示词", description: "提炼措施、做法和对策表达" },
  { key: "card_problem_statement", name: "问题表述提示词", description: "提炼治理难点和问题表述" },
  { key: "card_reason_analysis", name: "原因分析提示词", description: "提炼原因分析表达和逻辑框架" },
  { key: "card_policy_expression", name: "政策表述提示词", description: "提炼政策、会议、文件权威表述" },
  { key: "card_person_story", name: "人物事迹提示词", description: "提炼先进人物和基层故事素材" },
  { key: "card_article_structure", name: "文章框架提示词", description: "提炼文章结构、标题和分论点组织方式" },
];

function isPromptTemplateKey(key: string): key is PromptTemplateKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_PROMPT_TEMPLATES, key);
}

export function assertPromptTemplateKey(key: string): PromptTemplateKey {
  if (!isPromptTemplateKey(key)) {
    throw new Error("无效的提示词类型");
  }
  return key;
}

export async function getPromptTemplate(key: PromptTemplateKey): Promise<string> {
  const fallback = DEFAULT_PROMPT_TEMPLATES[key];
  const promptClient = (db as unknown as {
    aiPromptTemplate?: {
      findUnique: (args: {
        where: { key: string };
        select: { content: true; enabled: true };
      }) => Promise<{ content: string; enabled: boolean } | null>;
    };
  }).aiPromptTemplate;

  if (!promptClient) return fallback;

  try {
    const custom = await promptClient.findUnique({
      where: { key },
      select: { content: true, enabled: true },
    });
    const content = custom?.enabled ? custom.content.trim() : "";
    return content || fallback;
  } catch (error) {
    console.error("读取 AI 提示词失败，已回退默认提示词", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export function renderPromptTemplate(
  template: string,
  variables: Record<string, string | string[] | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (Array.isArray(value)) return value.join("、");
    return value ?? "";
  });
}

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
  const aiContent = buildAiContent(content);
  const systemPrompt = renderPromptTemplate(await getPromptTemplate(CARD_TYPE_PROMPT_KEYS[cardType]), {
    title,
    sourceName,
    content: aiContent,
  });

  const userPrompt = `请分析以下文章，生成素材卡：

【标题】${title}
【来源】${sourceName}
【正文】
${aiContent}`;

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
