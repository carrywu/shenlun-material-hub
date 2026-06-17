import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiConfigFindFirst: vi.fn(),
  promptFindUnique: vi.fn(),
  createChatCompletion: vi.fn(),
  decrypt: vi.fn((value: string) => value),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiConfig: {
      findFirst: mocks.aiConfigFindFirst,
    },
    aiPromptTemplate: {
      findUnique: mocks.promptFindUnique,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((value: string) => value),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mocks.createChatCompletion } };
  },
}));

async function importAi() {
  vi.resetModules();
  return import("../ai");
}

describe("AI prompt templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // P0-4 后不再 env fallback，统一喂 DB 全局配置 + 加密 key
    mocks.aiConfigFindFirst.mockResolvedValue({
      id: "cfg-default",
      encryptedKey: "sk-test-1234",
      baseUrl: "https://api.test.com/v1",
      model: "test-model",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    process.env.AI_CONFIG_ENCRYPTION_KEY = "12345678901234567890123456789012";
    mocks.promptFindUnique.mockResolvedValue(null);
    mocks.createChatCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            decision: "accept",
            contentGenre: "case_practice",
            reason: "正文包含具体服务保障举措，具有申论素材价值。",
            categories: ["民生服务", "考试保障"],
            usableFor: ["论证公共服务精细化"],
            summary: "广东多部门联动保障高考顺利进行。",
            quotes: ["全省多地暖心筹备、多部门联动值守。"],
          }),
        },
      }],
    });
    process.env.AI_API_KEY = "sk-test-1234";
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
  });

  it("exposes prompt definitions without data_fact templates", async () => {
    const { PROMPT_TEMPLATE_DEFINITIONS } = await importAi();

    const keys = PROMPT_TEMPLATE_DEFINITIONS.map((template) => template.key);
    expect(keys).toContain("article_evaluation");
    expect(keys).toContain("card_golden_sentence");
    expect(keys).not.toContain("card_data_fact");
  });

  it("uses a non-empty custom prompt before the code default", async () => {
    mocks.promptFindUnique.mockResolvedValue({
      key: "card_golden_sentence",
      content: " 自定义金句提示词 ",
      enabled: true,
    });
    const { getPromptTemplate } = await importAi();

    await expect(getPromptTemplate("card_golden_sentence")).resolves.toBe("自定义金句提示词");
  });

  it("falls back to the default prompt when the custom prompt is empty", async () => {
    mocks.promptFindUnique.mockResolvedValue({
      key: "card_golden_sentence",
      content: "   ",
      enabled: true,
    });
    const { getPromptTemplate } = await importAi();

    const prompt = await getPromptTemplate("card_golden_sentence");
    expect(prompt).toContain("申论写作金句");
  });

  it("renders supported prompt variables", async () => {
    const { renderPromptTemplate } = await importAi();

    expect(renderPromptTemplate("标题：{{title}}，来源：{{sourceName}}", {
      title: "基层治理",
      sourceName: "人民日报",
    })).toBe("标题：基层治理，来源：人民日报");
  });

  it("sends article title and body in the default article evaluation prompt", async () => {
    const { assessRelevance } = await importAi();

    await assessRelevance(
      "高考今日启幕 全省暖心护航",
      "广东省政府网",
      "6月7日，2026年广东夏季高考正式启幕。全省多部门联动值守，从考场布置到交通安全、贴心服务，确保考试规范有序、安全顺利进行。",
      "policy_analysis"
    );

    const params = mocks.createChatCompletion.mock.calls[0][0];
    const systemPrompt = params.messages[0].content;
    expect(systemPrompt).toContain("标题：高考今日启幕 全省暖心护航");
    expect(systemPrompt).toContain("来源：广东省政府网");
    expect(systemPrompt).toContain("内容类型：policy_analysis");
    expect(systemPrompt).toContain("广东夏季高考正式启幕");
    expect(systemPrompt).toContain("交通安全、贴心服务");
  });

  it("appends the standard article input block when a custom article prompt omits content", async () => {
    mocks.promptFindUnique.mockResolvedValue({
      key: "article_evaluation",
      content: "请严格输出 JSON，不要输出 markdown。",
      enabled: true,
    });
    const { assessRelevance } = await importAi();

    await assessRelevance(
      "高考今日启幕 全省暖心护航",
      "广东省政府网",
      "高考期间，广东围绕考场布置、交通安全、应急服务等环节提供保障。",
      "policy_analysis"
    );

    const params = mocks.createChatCompletion.mock.calls[0][0];
    const systemPrompt = params.messages[0].content;
    expect(systemPrompt).toContain("请严格输出 JSON，不要输出 markdown。");
    expect(systemPrompt).toContain("## 待评估文章");
    expect(systemPrompt).toContain("标题：高考今日启幕 全省暖心护航");
    expect(systemPrompt).toContain("高考期间，广东围绕考场布置、交通安全、应急服务等环节提供保障。");
  });

  it("does not duplicate the article input block when a custom article prompt already includes content", async () => {
    mocks.promptFindUnique.mockResolvedValue({
      key: "article_evaluation",
      content: "请评估：{{title}}\n正文：{{content}}",
      enabled: true,
    });
    const { assessRelevance } = await importAi();

    await assessRelevance(
      "高考今日启幕 全省暖心护航",
      "广东省政府网",
      "高考期间，广东围绕考场布置、交通安全、应急服务等环节提供保障。",
      "policy_analysis"
    );

    const params = mocks.createChatCompletion.mock.calls[0][0];
    const systemPrompt = params.messages[0].content;
    expect(systemPrompt).toContain("请评估：高考今日启幕 全省暖心护航");
    expect(systemPrompt).toContain("正文：高考期间，广东围绕考场布置、交通安全、应急服务等环节提供保障。");
    expect(systemPrompt).not.toContain("## 待评估文章");
  });

  it("uses buildAiContent so long article evaluation prompts contain head, tail, and omission marker", async () => {
    const { assessRelevance } = await importAi();
    const longContent = `${"高考护航开头。".repeat(250)}${"中间内容。".repeat(1000)}结尾保留交通安全和贴心服务。`;

    await assessRelevance("长文评估", "广东省政府网", longContent, "policy_analysis");

    const params = mocks.createChatCompletion.mock.calls[0][0];
    const systemPrompt = params.messages[0].content;
    expect(systemPrompt).toContain("高考护航开头。");
    expect(systemPrompt).toContain("结尾保留交通安全和贴心服务。");
    expect(systemPrompt).toContain("中间内容已省略");
  });
});
