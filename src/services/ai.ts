import OpenAI from "openai";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { CardType, AIScoreDetail, ContentGenre, AiDecision } from "@/types";

let _openai: OpenAI | null = null;
let _configLoaded = false;

async function getOpenAI(): Promise<OpenAI> {
  if (_openai && _configLoaded) return _openai;

  // 优先从数据库读取配置
  try {
    const config = await db.aiConfig.findFirst({
      where: { name: "default", isEnabled: true },
    });

    if (config) {
      const apiKey = decrypt(config.encryptedKey);
      _openai = new OpenAI({
        apiKey,
        baseURL: config.baseUrl || undefined,
      });
      _configLoaded = true;
      return _openai;
    }
  } catch {
    // 数据库读取失败，降级到环境变量
  }

  // 降级到环境变量
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_BASE_URL || undefined,
    });
  }
  _configLoaded = true;
  return _openai;
}

async function getModel(): Promise<string> {
  try {
    const config = await db.aiConfig.findFirst({
      where: { name: "default", isEnabled: true },
      select: { model: true },
    });
    if (config) return config.model;
  } catch {
    // ignore
  }
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
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
  const openai = await getOpenAI();
  const model = await getModel();
  const temperature = await getTemperature();

  const userPrompt = `请评估以下文章是否适合作为申论备考素材：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${content.slice(0, 4000)}`;

  const completion = await openai.chat.completions.create({
    model,
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
  const openai = await getOpenAI();
  const model = await getModel();

  const userPrompt = `请对以下文章进行评分：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${content.slice(0, 4000)}`;

  const completion = await openai.chat.completions.create({
    model,
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
  sourceSnapshot: string;
  originalFacts: string;
  aiSummary: string;
  highlightSuggestions: string;
  transferSuggestions: string;
}

export async function generateCardForContentItem(
  title: string,
  sourceName: string,
  content: string,
  cardType: CardType
): Promise<AIGeneratedCardData> {
  const openai = await getOpenAI();
  const model = await getModel();
  const systemPrompt = CARD_TYPE_PROMPTS[cardType];

  const userPrompt = `请分析以下文章，生成素材卡：

【标题】${title}
【来源】${sourceName}
【正文】
${content}`;

  const completion = await openai.chat.completions.create({
    model,
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

  const data: AIGeneratedCardData = JSON.parse(rawJson);

  if (!data.aiSummary) {
    throw new Error("AI 返回数据结构不完整");
  }

  return data;
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
    const openai = await getOpenAI();
    const model = await getModel();

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "回复 OK" }],
      max_tokens: 50,
    });

    const message = completion.choices[0]?.message;
    const content = message?.content;
    const reasoning = (message as Record<string, unknown>)?.reasoning_content;
    return { success: !!(content || reasoning) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "测试失败",
    };
  }
}
