import { getAiRuntime, getPromptTemplate, parseAiJson } from "@/services/ai";

// ==================== 文章批注生成 ====================

export interface AnnotationResult {
  comment: string;
  highlight: boolean;
  tags: string[];
}

export async function generateAnnotation(
  articleTitle: string,
  articleContent: string,
  selectedText: string,
  cardType?: string,
  userId?: string
): Promise<AnnotationResult> {
  const runtime = await getAiRuntime(userId);
  const systemPrompt = await getPromptTemplate("annotation_selected");

  // P2-22: limit selectedText to 2000 chars to avoid exceeding token limits
  const trimmedSelectedText = selectedText.slice(0, 2000);
  const contextSnippet = articleContent.slice(0, 3000);

  const userPrompt = `【文章标题】${articleTitle}

【文章内容（节选）】
${contextSnippet}

【选中的文本】
${trimmedSelectedText}
${cardType ? `\n【关联素材卡类型】${cardType}` : ""}

请对选中的文本进行申论备考角度的批注分析。`;

  const completion = await runtime.client.chat.completions.create({
    model: runtime.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) {
    throw new Error("AI 未返回有效批注内容");
  }

  const data = parseAiJson(rawJson, "批注结果");

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
  articleContent: string,
  userId?: string
): Promise<Array<{ paragraph: number; selectedText: string; comment: string; tags: string[] }>> {
  const runtime = await getAiRuntime(userId);
  const systemPrompt = await getPromptTemplate("annotation_auto");

  const content = articleContent.slice(0, 5000);

  const completion = await runtime.client.chat.completions.create({
    model: runtime.model,
    messages: [
      { role: "system", content: systemPrompt },
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

  const data = parseAiJson(rawJson, "自动批注结果");
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];

  return annotations.map((a: Record<string, unknown>, i: number) => ({
    paragraph: typeof a.paragraph === "number" ? a.paragraph : i,
    selectedText: String(a.selectedText || "").slice(0, 1000),
    comment: String(a.comment || "").slice(0, 500),
    tags: Array.isArray(a.tags) ? a.tags.slice(0, 5) : [],
  }));
}
