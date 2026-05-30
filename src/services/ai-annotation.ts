import OpenAI from "openai";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

let _openai: OpenAI | null = null;
let _configLoaded = false;

async function getOpenAI(): Promise<OpenAI> {
  if (_openai && _configLoaded) return _openai;

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
    // 降级到环境变量
  }

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

// ==================== 文章批注生成 ====================

const ANNOTATION_SYSTEM_PROMPT = `你是一位资深的申论辅导专家。请对以下文章选段进行批注分析。

你的批注需要：
1. 分析选段在文章中的作用和意义
2. 指出值得学习的写作技巧或论证方法
3. 提供可迁移使用的建议

返回 JSON：
{
  "comment": "对选段的详细分析和批注（150字以内）",
  "highlight": true,
  "tags": ["标签1", "标签2"]
}`;

export interface AnnotationResult {
  comment: string;
  highlight: boolean;
  tags: string[];
}

export async function generateAnnotation(
  articleTitle: string,
  articleContent: string,
  selectedText: string,
  cardType?: string
): Promise<AnnotationResult> {
  const openai = await getOpenAI();
  const model = await getModel();

  const contextSnippet = articleContent.slice(0, 3000);

  const userPrompt = `【文章标题】${articleTitle}

【文章内容（节选）】
${contextSnippet}

【选中的文本】
${selectedText}
${cardType ? `\n【关联素材卡类型】${cardType}` : ""}

请对选中的文本进行申论备考角度的批注分析。`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: ANNOTATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效批注内容");
  }

  const data = JSON.parse(rawJson);

  return {
    comment: String(data.comment || "").slice(0, 500),
    highlight: data.highlight !== false,
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
  };
}

/**
 * 为文章自动生成段落批注
 */
export async function autoAnnotateArticle(
  articleId: string,
  articleTitle: string,
  articleContent: string
): Promise<Array<{ paragraph: number; selectedText: string; comment: string; tags: string[] }>> {
  const openai = await getOpenAI();
  const model = await getModel();

  const AUTO_ANNOTATE_PROMPT = `你是一位资深的申论辅导专家。请从文章中选出 3-5 个最值得批注的段落或语句，进行申论备考角度的分析。

选择标准：
1. 包含关键论点或论据的段落
2. 有数据支撑的论述
3. 可迁移使用的经典表达
4. 有代表性的案例或政策引用

返回 JSON：
{
  "annotations": [
    {
      "selectedText": "选中的原文片段",
      "paragraph": 0,
      "comment": "批注分析（100字以内）",
      "tags": ["标签"]
    }
  ]
}`;

  const content = articleContent.slice(0, 5000);

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: AUTO_ANNOTATE_PROMPT },
      {
        role: "user",
        content: `【文章标题】${articleTitle}\n\n【正文】\n${content}`,
      },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回自动批注结果");
  }

  const data = JSON.parse(rawJson);
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];

  return annotations.map((a: Record<string, unknown>, i: number) => ({
    paragraph: typeof a.paragraph === "number" ? a.paragraph : i,
    selectedText: String(a.selectedText || "").slice(0, 1000),
    comment: String(a.comment || "").slice(0, 500),
    tags: Array.isArray(a.tags) ? a.tags.slice(0, 5) : [],
  }));
}
