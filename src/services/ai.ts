import OpenAI from "openai";
import type { MaterialCardStructuredContent } from "@/types";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

const SYSTEM_PROMPT = `你是一位资深的申论辅导专家，擅长从官方文章中提炼可用于申论写作的素材。

你的任务是分析给定的官方文章，生成结构化的申论素材卡。

请严格按照以下 JSON 格式返回，不要包含任何其他文字：

{
  "mainPoint": "用一句话概括文章的核心主旨",
  "structure": {
    "background": "事件或政策的背景描述",
    "problem": "文章揭示的核心问题",
    "cause": "问题产生的深层原因",
    "solution": "文章提出的对策或解决路径",
    "sublimation": "从个案上升到普遍意义的升华表述"
  },
  "standardExpressions": ["规范表达1", "规范表达2", "规范表达3"],
  "cases": ["可引用的具体案例或数据"],
  "provinceRelevance": {
    "guangdong": "与广东省情的关联分析",
    "hunan": "与湖南省情的关联分析"
  },
  "applicableTypes": ["申论大作文", "综合分析题", "面试综合分析题"],
  "writingExercise": "基于本文素材的仿写练习提示，给出一个模拟话题让考生练习运用"
}

要求：
1. 规范表达要精炼、可直接用于申论写作，3-5个
2. 案例要具体，包含关键数据或事实
3. 省情关联要结合广东和湖南的实际发展情况
4. 仿写练习要给出具体话题和写作方向指引`;

function buildUserPrompt(title: string, source: string, content: string, category: string): string {
  return `请分析以下官方文章，生成申论素材卡：

【标题】${title}
【来源】${source}
【分类】${category}
【正文】
${content}`;
}

export async function generateMaterialCard(
  title: string,
  source: string,
  content: string,
  category: string
): Promise<{ structured: MaterialCardStructuredContent; rawJson: string }> {
  const userPrompt = buildUserPrompt(title, source, content, category);

  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效内容");
  }

  const structured: MaterialCardStructuredContent = JSON.parse(rawJson);

  // Basic validation
  if (!structured.mainPoint || !structured.structure) {
    throw new Error("AI 返回数据结构不完整");
  }

  return { structured, rawJson };
}

export async function generateBatchMaterialCards(
  articles: Array<{ id: string; title: string; source: string; content: string; category: string }>,
  concurrency: number = 3
): Promise<Array<{ articleId: string; success: boolean; data?: { structured: MaterialCardStructuredContent; rawJson: string }; error?: string }>> {
  const results: Array<{ articleId: string; success: boolean; data?: { structured: MaterialCardStructuredContent; rawJson: string }; error?: string }> = [];

  // Process in batches with limited concurrency
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (article) => {
        try {
          const data = await generateMaterialCard(
            article.title,
            article.source,
            article.content,
            article.category
          );
          return { articleId: article.id, success: true, data };
        } catch (error) {
          return {
            articleId: article.id,
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
