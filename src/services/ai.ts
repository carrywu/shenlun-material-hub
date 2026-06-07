import OpenAI from "openai";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";
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
const cachedRuntimeByUser = new Map<string, AiRuntime>();

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
  cachedRuntimeByUser.clear();
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

async function resolveAiRuntimeConfig(userId?: string): Promise<{
  apiKey: string;
  model: string;
  source: AiRuntimeSource;
  baseURL?: string;
  cacheKey: string;
}> {
  try {
    // Phase 3: If userId provided, require user-specific config (no fallback)
    if (userId) {
      const config = await db.aiConfig.findFirst({
        where: { userId, isEnabled: true },
        select: {
          id: true,
          encryptedKey: true,
          baseUrl: true,
          model: true,
          updatedAt: true,
        },
      });

      if (!config) {
        throw new AiServiceError(
          "AI_CONFIG_MISSING",
          "您尚未配置 AI 服务。请前往「设置 → AI 配置」填写您的 API Key",
          400,
          { source: "db" }
        );
      }

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
          "您的 AI 配置中的 API Key 为空，请重新保存配置",
          400,
          { source: "db", baseURL: config.baseUrl, model: config.model }
        );
      }

      return {
        apiKey: trimmedApiKey,
        model: trimConfigValue(config.model) ?? "deepseek-chat",
        source: "db",
        baseURL: trimConfigValue(config.baseUrl),
        cacheKey: `db:${config.id}:${config.updatedAt.toISOString()}`,
      };
    }

    // System-level (no userId): use global config → env fallback
    const config = await db.aiConfig.findFirst({
      where: { name: "default", isEnabled: true, userId: null },
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
        model: trimConfigValue(config.model) ?? "deepseek-chat",
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
  const envModel = trimConfigValue(process.env.AI_MODEL) ?? trimConfigValue(process.env.OPENAI_MODEL) ?? "deepseek-chat";

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

export async function getAiRuntime(userId?: string): Promise<AiRuntime> {
  const config = await resolveAiRuntimeConfig(userId);

  // Per-user cache keyed by userId (or "global" for unauthenticated)
  const cacheKey = userId ?? "global";

  if (userId) {
    const cached = cachedRuntimeByUser.get(cacheKey);
    if (cached?.cacheKey === config.cacheKey) {
      return cached;
    }
  } else {
    if (cachedRuntime?.cacheKey === config.cacheKey) {
      return cachedRuntime;
    }
  }

  const runtime: AiRuntime = {
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

  if (userId) {
    cachedRuntimeByUser.set(cacheKey, runtime);
  } else {
    cachedRuntime = runtime;
  }

  return runtime;
}

export async function getOpenAI(): Promise<{ openai: OpenAI; model: string }> {
  const runtime = await getAiRuntime();
  return { openai: runtime.client, model: runtime.model };
}

async function getTemperature(userId?: string): Promise<number> {
  try {
    // P1-4 fix: prefer user-specific config, fall back to global
    if (userId) {
      const userConfig = await db.aiConfig.findFirst({
        where: { userId, isEnabled: true },
        select: { temperature: true },
      });
      if (userConfig) return userConfig.temperature;
    }
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
  const safeMsg = safeProviderMessage(error);

  // Log AI errors to SystemLog for production diagnostics
  void logger.error("AI request failed", "AI", {
    status,
    source: runtime.source,
    model: runtime.model,
    keySuffix: runtime.keySuffix,
    providerMessage: safeMsg ?? undefined,
  });

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
      providerMessage: safeMsg,
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

export function parseAiJson(rawJson: string, context: string): Record<string, unknown> {
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

const RELEVANCE_SYSTEM_PROMPT = `你是一位拥有 10 年以上省考/国考申论阅卷与教学经验的申论辅导专家。你的任务是判断一篇文章是否值得纳入申论备考素材库。

## 核心评估维度

请从以下四个维度综合判断：

1. **素材密度**：文章中是否包含可直接引用的金句、案例、数据、对策表达？（最重要）
2. **观点深度**：文章是否有独立分析和论证，而非简单的信息罗列或事件报道？
3. **话题相关性**：文章主题是否属于申论常考领域（治理、民生、经济、文化、生态、科技、法治等）？
4. **时效与权威性**：来源是否可信？内容是否具有较长的参考价值？

## 体裁分类规则（contentGenre）

- commentary（评论）：人民时评、光明网评、社论、署名评论文章
- policy_interpretation（政策解读）：对政策文件、会议精神、政府工作报告的深度解读
- case_practice（案例实践）：地方治理案例、基层创新实践、典型经验做法的报道
- ordinary_news（普通新闻）：仅报道事件经过，无实质性分析或观点
- meeting_news（会议新闻）：领导活动报道、会议纪要、座谈会等程序性报道
- notice（通知公告）：政府通知、公告、规章条例原文
- other：不属于以上任何类型

## 判定标准

**接受（accept）**——满足以下任一条件：
- 文章含有 3 条以上可直接引用的申论素材（金句、案例、数据、对策）
- 文章有清晰的论证结构，观点鲜明，逻辑完整
- 文章包含权威政策解读或实践案例，有明确的治理启示

**拒绝（reject）**——满足以下任一条件：
- 纯粹的事件报道，无分析、无观点、无可引用素材
- 会议程序性报道（某某领导出席、强调、指出……）
- 通知公告原文，缺乏解读
- 内容空泛、套话连篇，无实质信息
- 商业软文、广告、营销内容

## 不要做的事

- 不要因为文章"主题相关"就自动接受——主题相关但素材密度为零的文章应当拒绝
- 不要对所有评论文章一律接受——套话评论同样应拒绝
- 不要在 summary 中重复标题内容

## 输出要求

返回严格的 JSON（不要加 markdown 代码块标记）：
{
  "decision": "accept 或 reject",
  "contentGenre": "上述 7 种体裁之一",
  "reason": "80 字以内的判定理由，需具体说明文章的素材价值或拒绝原因",
  "categories": ["主题标签1", "主题标签2"],
  "usableFor": ["适用的申论写作场景"],
  "summary": "150 字以内的内容摘要，提炼文章核心观点和关键信息（仅 accept 时填写，reject 时留空字符串）",
  "quotes": ["从原文中摘录的 2-5 条最有价值的金句或关键表述"]
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
  contentType: string,
  userId?: string
): Promise<RelevanceResult> {
  const runtime = await getAiRuntime(userId);
  const temperature = await getTemperature(userId);
  const systemPrompt = renderPromptTemplate(await getPromptTemplate("article_evaluation"), {
    title,
    sourceName,
    contentType,
    content: buildAiContent(content),
  });

  // P1-1 fix: user prompt no longer duplicates content — it's already in systemPrompt via template
  const userPrompt = `请根据以上要求评估这篇文章。`;

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

  const data = parseAiJson(rawJson, "评估结果");

  return {
    decision: data.decision === "accept" ? "accept" : "reject",
    contentGenre: validateContentGenre(String(data.contentGenre ?? "")),
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
  options?: { maxRetries?: number; timeoutMs?: number; userId?: string }
): Promise<RelevanceResult> {
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const backoffDelays = [1000, 3000];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        assessRelevance(title, sourceName, content, contentType, options?.userId),
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
  contentType: string,
  userId?: string
): Promise<AIScoreResult> {
  const runtime = await getAiRuntime(userId);

  const userPrompt = `请对以下文章进行评分：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${buildAiContent(content)}`;

  // Note: scoreContentItem doesn't use renderPromptTemplate, so content goes in userPrompt only (no duplication)

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

  const data = parseAiJson(rawJson, "评分结果");

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
  golden_sentence: `你是一位拥有丰富申论教学经验的写作指导专家，擅长从政论文章中提炼高质量的申论写作金句。

## 什么是好的申论金句？

好的申论金句应当满足以下特征（至少满足 2 项）：
- **语言凝练**：用精炼的表达浓缩深刻观点，通常 15-40 字
- **逻辑性强**：包含因果、递进、转折等论证逻辑
- **修辞精彩**：运用排比、对偶、比喻等修辞手法
- **观点鲜明**：有明确的价值判断或立场表达
- **通用性好**：稍加改动即可迁移到不同话题

## 提取要求

1. 从原文中精确摘录 3-8 条最优质的金句，优先选择：
   - 文章标题中的精华表述
   - 段首段尾的概括性语句
   - 含有数据支撑的论断
   - 政策性表述中的精炼概括
2. 每条金句标注其在原文中的大致位置（开头/中部/结尾）
3. 如果原文金句密度不高，宁可少提取几条，也不要凑数

## 不要提取的内容

- 普通的叙事性句子（如"近日，某某市召开了……"）
- 没有观点的纯数据罗列
- 过于口语化或缺乏文采的表述

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【金句摘录】逐条列出原文金句，每条标注出处位置（开头/中部/结尾），保持原文用词",
  "aiSummary": "这些金句的共性特征分析：修辞手法、表达技巧、语言风格（100 字以内）",
  "highlightSuggestions": "【重点推荐】最值得背诵的 1-3 条金句，每条附注推荐用于申论的开头/结尾/分论点升华",
  "transferSuggestions": "【迁移指南】这些金句可迁移的 3-5 个申论话题领域，每个话题附一句迁移改写示例"
}`,

  standard_expression: `你是一位熟悉政府公文写作和申论阅卷标准的语言专家，擅长从政策文章中提炼规范化的政务表达。

## 什么是申论规范词？

规范词是政府公文、领导讲话、政策文件中反复使用的固定搭配和标准句式。掌握规范词可以让申论作答更加专业、精准，避免口语化。

常见类型：
- **动宾搭配**：如"健全机制"、"夯实基础"、"激发活力"
- **四字格表达**：如"统筹兼顾"、"精准施策"、"守正创新"
- **政策术语**：如"放管服改革"、"新质生产力"、"共同富裕"
- **规范句式**：如"以……为抓手"、"坚持……导向"、"构建……格局"

## 提取要求

1. 提取 5-15 条规范表达，按类型分组
2. 每条保留原文语境（前后各 5-10 字），便于理解用法
3. 标注每条表达的规范程度（★★★ 高频核心 / ★★ 常用 / ★ 可选）
4. 不要提取日常口语中也常用的普通词汇

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【规范表达摘录】按类型分组列出，每条附原文语境示例",
  "aiSummary": "这些规范表达的整体特点：适用的文体层级、语体风格（80 字以内）",
  "highlightSuggestions": "【必背推荐 ★★★】最高频、最实用的 3-5 条规范表达，附申论中的典型使用场景",
  "transferSuggestions": "【替换对照表】将 3-5 个常见的口语化表述替换为规范表达，附适用题型"
}`,

  case_material: `你是一位擅长整理治理案例的申论素材专家，能够从新闻报道中提炼出结构清晰、信息完整的案例素材卡。

## 好的申论案例素材应包含

一个完整的案例素材应具备"四要素"：
1. **主体**：谁做的？（某市/某区/某部门/某企业/某基层组织）
2. **做法**：做了什么？具体措施是什么？
3. **成效**：取得了什么效果？最好有数据支撑
4. **启示**：这个案例说明了什么治理逻辑或价值理念？

## 提取要求

1. 提取 1-3 个核心案例（一篇文章可能只有一个案例，不要硬拆）
2. 每个案例按"主体—做法—成效—启示"四要素结构化整理
3. 保留关键数据和具体细节（如"投入资金 2.3 亿元"、"惠及 15 万群众"）
4. 案例描述控制在 100-200 字，做到"一段话讲清一个案例"

## 不要做的事

- 不要把背景介绍当案例
- 不要遗漏具体的数据和细节
- 不要把一个案例拆成多个

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【案例整理】每个案例按四要素结构化列出：主体、做法、成效、启示（如有多个案例依次列出）",
  "aiSummary": "案例的典型意义：体现了什么治理理念？解决了什么核心问题？（100 字以内）",
  "highlightSuggestions": "【引用亮点】最值得在申论中直接引用的 2-3 个具体细节或数据",
  "transferSuggestions": "【适用主题】该案例可用于哪 3-5 个申论话题，每个话题附一句引用示例"
}`,

  countermeasure: `你是一位擅长提炼对策表达的申论辅导专家，能从政策文章中提取结构化的对策措施表达。

## 什么是好的对策表达？

好的对策表达应具备：
- **规范性**：使用政府公文常见的对策句式（如"建立……机制"、"完善……制度"）
- **层次感**：对策有明确的维度分类，不是简单堆砌
- **操作性**：对策具体可执行，而非空泛的"加强管理"

## 对策分类维度

请按以下维度对提取的对策进行分类：
- **制度层面**：立法、规章、标准制定
- **机制层面**：体制机制改革、流程优化
- **技术层面**：数字化、智能化、技术创新
- **人才层面**：培训、引进、激励
- **宣传层面**：教育引导、舆论监督、文化建设
- **监督层面**：考核问责、第三方评估、群众监督
- **保障层面**：资金投入、基础设施、物资保障

## 提取要求

1. 提取 3-10 条对策，按上述维度分类
2. 每条对策保留原文的规范表述
3. 标注每条对策的适用层级（宏观政策层 / 中观部门层 / 微观执行层）
4. 如果文章中对策不多，宁可少列几条，不要自行编造

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【对策摘录】按维度分类逐条列出，保留原文规范表述，标注适用层级",
  "aiSummary": "对策的整体逻辑层次分析：覆盖了哪些维度？侧重哪个方向？（80 字以内）",
  "highlightSuggestions": "【重点推荐】最具操作性、最适合申论作答的 2-3 条对策表达",
  "transferSuggestions": "【迁移应用】这些对策可迁移到哪些申论话题？适用于对策题还是议论文对策段？"
}`,

  problem_statement: `你是一位擅长提炼问题表述的申论辅导专家，能从文章中提取精准的社会问题和治理难点表述。

## 什么是好的问题表述？

好的问题表述应具备：
- **精准概括**：用一两句话精准描述问题的本质
- **层次分明**：区分表象问题和深层问题
- **措辞规范**：使用政府公文中常见的问题描述方式
- **有分析价值**：指出问题的原因、影响或趋势

## 问题层次分类

- **表象层**：可直接观察到的现象和问题（如"就业难"、"看病贵"）
- **机制层**：制度设计或运行中的问题（如"权责不清"、"激励不足"）
- **根源层**：深层次的结构性、体制性问题（如"发展不平衡"、"治理能力不足"）

## 提取要求

1. 提取 3-8 条问题表述，按上述层次分类
2. 每条保留原文的规范用语
3. 简要标注每条问题的影响范围（全局性/局部性/行业性）
4. 不要把文章中的建议或对策误当成问题

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【问题摘录】按表象层/机制层/根源层分类列出，保留原文用语，标注影响范围",
  "aiSummary": "问题的整体画像：核心矛盾是什么？这些问题之间有什么关联？（100 字以内）",
  "highlightSuggestions": "【精华表述】最精准、最有概括力的 2-3 条问题表述，适合在申论中直接引用",
  "transferSuggestions": "【迁移应用】这些问题表述可应用于哪些申论主题和写作场景"
}`,

  reason_analysis: `你是一位擅长提炼原因分析表达的申论辅导专家，能从文章中提取多维度、有层次的原因分析。

## 什么是好的原因分析？

好的原因分析应具备：
- **多角度**：从不同维度切入（主观/客观、内因/外因、直接/根本）
- **有逻辑**：原因之间有层次关系，而非简单并列
- **表述规范**：使用"究其原因"、"深层来看"、"从根本上说"等分析性语言

## 原因分析维度

请按以下维度对原因进行分类：
- **主观 vs 客观**：认识不足、重视不够 vs 条件制约、资源匮乏
- **直接 vs 根本**：表面触发因素 vs 深层结构性原因
- **内因 vs 外因**：自身问题 vs 环境制约
- **历史 vs 现实**：历史遗留 vs 当前新问题

## 提取要求

1. 提取 3-8 条原因分析表述
2. 每条标注其维度分类（如"客观-根本-外因"）
3. 保留原文的分析性语言和逻辑连接词
4. 如果原因之间存在因果链条，请标注递进关系

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【原因分析摘录】按维度分类逐条列出，标注分析维度，保留原文分析性语言",
  "aiSummary": "原因分析的整体框架：涉及哪些维度？核心逻辑链条是什么？（100 字以内）",
  "highlightSuggestions": "【学习重点】最值得学习的 2-3 条原因分析表达方式，说明其分析技巧",
  "transferSuggestions": "【迁移应用】这些原因分析可迁移的 3-5 个申论话题和适用题型"
}`,

  policy_expression: `你是一位熟悉国家政策体系的申论辅导专家，擅长从文章中提炼权威的政策表述。

## 什么是好的政策表述素材？

好的政策表述应具备：
- **权威性**：来自中央文件、国务院、部委政策或重要会议
- **准确性**：与原文完全一致，不可随意改写
- **时效性**：近 2 年内的最新政策表述优先
- **实用性**：可直接用于申论写作中引用或论证

## 政策层级分类

- **中央级**：党代会报告、中央全会决定、总书记重要讲话
- **国务院级**：政府工作报告、国务院政策文件、部委规划
- **地方级**：省市政策创新、地方实施方案

## 提取要求

1. 提取 3-8 条政策表述
2. 每条标注：政策名称/会议名称 + 政策层级 + 发布时间（如有）
3. 完整保留原文表述，不要缩减或改写
4. 区分"新提法/新表述"和"常规表述"，优先标记新提法

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【政策表述摘录】逐条列出，标注政策名称、层级和出处",
  "aiSummary": "政策的核心要义：体现了什么政策方向？有哪些关键变化？（100 字以内）",
  "highlightSuggestions": "【重点引用】最权威、最新、最值得引用的 2-3 条政策表述，附引用场景建议",
  "transferSuggestions": "【适用话题】这些政策表述可应用于哪些申论话题，每个话题附引用方式示例"
}`,

  person_story: `你是一位擅长整理人物事迹素材的申论辅导专家，能从报道中提取结构清晰、细节感人的人物素材卡。

## 好的人物事迹素材应包含

一个完整的人物素材应具备"四维度"：
1. **身份**：人物的职业、岗位、所在地区
2. **事迹**：具体做了什么？关键细节和数据
3. **品质**：体现了什么精神品质？（如担当、奉献、创新、坚韧）
4. **金句**：人物说过的感人话语或旁人的评价

## 提取要求

1. 提取 1-3 个核心人物（一篇文章通常聚焦 1-2 个人物）
2. 每个人物按"身份—事迹—品质—金句"四维度结构化整理
3. 保留最感人的细节（如"连续工作 72 小时"、"资助 300 名学生"）
4. 标注人物所体现的时代精神标签（如新时代奋斗者、基层治理先锋等）

## 不要做的事

- 不要用空泛的形容词代替具体事迹
- 不要遗漏关键的数据和细节
- 不要把集体事迹当成个人事迹

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【人物素材】每个人物按四维度结构化列出：身份、事迹、品质、金句",
  "aiSummary": "人物事迹的时代意义：体现了什么时代精神？对哪些社会议题有启示？（100 字以内）",
  "highlightSuggestions": "【感人细节】最有代表性的 2-3 个事迹细节，适合在申论中直接引用",
  "transferSuggestions": "【适用主题】这些人物素材可用于哪些申论主题（如奉献、担当、创新、基层治理等），附引用示例"
}`,

  article_structure: `你是一位擅长分析文章结构的申论写作教练，能从优质文章中提炼可复用的框架模板。

## 文章结构分析要素

请从以下五个方面拆解文章：
1. **标题句式**：标题的构成方式（对偶式/问句式/动宾式/比喻式等）
2. **开头模式**：引入方式（案例引入/数据引入/政策引入/问题引入/名言引入等）
3. **过渡手法**：段落之间如何衔接（递进/转折/并列/总分等）
4. **分论点结构**：分论点的数量、逻辑关系（并列/递进/对比）、句式特点
5. **结尾方式**：总结升华方式（回扣主题/展望未来/号召行动/引用名言等）

## 提取要求

1. 完整拆解文章的五层结构
2. 提炼每层结构的可复用模板（如"以……为……，让……更……"这样的句式模板）
3. 评价该框架的适用场景和优劣
4. 如果文章结构特别出色，标注具体的亮点

## 输出 JSON（不要加 markdown 代码块标记）

{
  "sourceSnapshot": "标题 | 来源名称 | 发布时间",
  "originalFacts": "【结构拆解】按五层结构逐一分析：标题句式、开头模式、过渡手法、分论点结构、结尾方式",
  "aiSummary": "文章结构的整体特点：是什么类型的框架？写作技巧上有什么值得学习的？（100 字以内）",
  "highlightSuggestions": "【模板提炼】最值得借鉴的 2-3 个结构模式或句式模板，可直接套用",
  "transferSuggestions": "【适用题型】该框架可应用于哪些申论题型（议论文/评论文/策论文等）和话题"
}`,
};

// ==================== 批注提示词 ====================

export const ANNOTATION_SELECTED_PROMPT = `你是一位资深的申论辅导专家。请对以下文章选段进行批注分析。

## 批注要求

请从申论备考的角度，对选中的文本段落进行深度分析：

1. **内容价值**：这段文字在文章论证中的作用（论点/论据/过渡/总结）
2. **写作技巧**：使用了哪些值得学习的表达技巧（修辞、句式、逻辑结构）
3. **素材价值**：是否包含可迁移的金句、数据、案例或规范表达
4. **迁移建议**：这段内容可用于哪些申论话题或写作场景

## 批注风格

- 精炼实用，避免空泛评价（如"写得好"、"值得学习"）
- 必须指出具体的亮点或技巧
- 如果选段价值有限，如实说明，不要硬夸

## 输出 JSON（不要加 markdown 代码块标记）

{
  "comment": "对选段的分析批注（150字以内），需具体指出亮点或技巧",
  "highlight": true,
  "tags": ["标签1", "标签2"]
}`;

export const ANNOTATION_AUTO_PROMPT = `你是一位资深的申论辅导专家。请从文章中选出 3-5 个最值得批注的段落或语句，进行申论备考角度的分析。

## 选择标准（按优先级排序）

1. **核心金句**：可直接引用到申论写作中的精彩表述
2. **关键论点**：文章的核心观点和主要论断
3. **数据论据**：有具体数据支撑的论述段落
4. **经典案例**：可迁移使用的治理案例或实践做法
5. **政策引用**：引用的政策文件或权威表述

## 批注要求

- 每条批注需具体指出该段落的素材价值和使用建议
- 避免空泛的评价，必须说明"好在哪里"、"怎么用"
- 选中的文本应是原文中的连续片段

## 输出 JSON（不要加 markdown 代码块标记）

{
  "annotations": [
    {
      "selectedText": "选中的原文片段（完整连续文本）",
      "paragraph": 0,
      "comment": "批注分析（100字以内），需具体说明素材价值和使用建议",
      "tags": ["标签"]
    }
  ]
}`;

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
  | "card_article_structure"
  | "annotation_selected"
  | "annotation_auto";

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
  annotation_selected: ANNOTATION_SELECTED_PROMPT,
  annotation_auto: ANNOTATION_AUTO_PROMPT,
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
  { key: "annotation_selected", name: "选段批注提示词", description: "对选中文本进行申论备考角度的批注分析" },
  { key: "annotation_auto", name: "自动批注提示词", description: "从全文中自动选取段落进行批注分析" },
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
  cardType: CardType,
  userId?: string
): Promise<AIGeneratedCardData> {
  const runtime = await getAiRuntime(userId);
  const aiContent = buildAiContent(content);
  const systemPrompt = renderPromptTemplate(await getPromptTemplate(CARD_TYPE_PROMPT_KEYS[cardType]), {
    title,
    sourceName,
    content: aiContent,
  });

  // P1-1 fix: user prompt no longer duplicates content — it's already in systemPrompt via template
  const userPrompt = `请根据以上要求，为这篇文章生成素材卡。`;

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
  concurrency: number = 3,
  userId?: string
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
            item.cardType,
            userId
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
export async function testAiConfig(userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const runtime = await getAiRuntime(userId);

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
