import OpenAI from "openai";
import type { CardType, AIScoreDetail } from "@/types";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// ==================== AI 评分 ====================

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
  const userPrompt = `请对以下文章进行评分：

【标题】${title}
【来源】${sourceName}
【内容类型】${contentType}
【正文】
${content.slice(0, 4000)}`;

  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
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

  // Validate scores
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
      detail[dim] = 5; // default
    } else {
      detail[dim] = Math.round(score);
    }
  }

  // Weighted average (relevance and usability weighted higher)
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

// Card type specific prompts
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
  const systemPrompt = CARD_TYPE_PROMPTS[cardType];

  const userPrompt = `请分析以下文章，生成素材卡：

【标题】${title}
【来源】${sourceName}
【正文】
${content}`;

  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
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
