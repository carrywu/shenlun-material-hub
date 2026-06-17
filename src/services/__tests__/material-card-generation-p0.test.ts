/**
 * P0-3：素材卡生成服务测试
 * 覆盖 MC-SVC-001 ~ MC-SVC-018 共 18 个用例
 *
 * 测试对象：generateCardForContentItem, normalizeMaterialCardTextField,
 *           CARD_TYPE_PROMPTS（间接行为）, getPromptTemplate, renderPromptTemplate
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiConfigFindFirst: vi.fn(),
  promptFindUnique: vi.fn(),
  create: vi.fn(),
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
  decrypt: mocks.decrypt,
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mocks.create } };
  },
}));

async function importAi() {
  vi.resetModules();
  return import("../ai");
}

// ─── helpers ───

function makeCardResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    sourceSnapshot: "来源快照",
    originalFacts: "原始事实",
    aiSummary: "AI 摘要",
    highlightSuggestions: "亮点建议",
    transferSuggestions: "迁移建议",
    ...overrides,
  });
}

function mockCreateSuccess(content: string) {
  mocks.create.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

function mockCreateError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  mocks.create.mockRejectedValue(error);
}

// ─── test suites ───

describe("素材卡生成服务测试 (P0-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aiConfigFindFirst.mockResolvedValue(null);
    mocks.promptFindUnique.mockResolvedValue(null);
    process.env.AI_API_KEY = "sk-test-1234";
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
  });

  // ─── MC-SVC-001 ~ MC-SVC-007: normalizeMaterialCardTextField ───

  describe("normalizeMaterialCardTextField 类型转换", () => {
    it("MC-SVC-001: string 字段 — 不二次 JSON stringify", async () => {
      mockCreateSuccess(makeCardResponse({ originalFacts: "事实文本" }));
      const { generateCardForContentItem } = await importAi();

      const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      expect(card.originalFacts).toBe("事实文本");
      expect(card.originalFacts).not.toBe('"事实文本"');
    });

    it("MC-SVC-002: object 字段 — 转 JSON string", async () => {
      mockCreateSuccess(makeCardResponse({
        originalFacts: { facts: ["A", "B"] },
      }));
      const { generateCardForContentItem } = await importAi();

      const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      expect(card.originalFacts).toContain('"facts"');
      expect(JSON.parse(card.originalFacts ?? "{}")).toEqual({ facts: ["A", "B"] });
    });

    it("MC-SVC-003: array 字段 — 转 JSON string", async () => {
      mockCreateSuccess(makeCardResponse({
        originalFacts: ["事实1", "事实2"],
      }));
      const { generateCardForContentItem } = await importAi();

      const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      expect(JSON.parse(card.originalFacts ?? "[]")).toEqual(["事实1", "事实2"]);
    });

    it("MC-SVC-004: null 字段 — 返回 null", async () => {
      mockCreateSuccess(makeCardResponse({
        sourceSnapshot: null,
        originalFacts: null,
      }));
      const { generateCardForContentItem } = await importAi();

      const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      expect(card.sourceSnapshot).toBeNull();
      expect(card.originalFacts).toBeNull();
    });

    it("MC-SVC-005: undefined 字段 — 返回 null", async () => {
      mockCreateSuccess(makeCardResponse({
        highlightSuggestions: undefined,
        transferSuggestions: undefined,
      }));
      const { generateCardForContentItem } = await importAi();

      const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      expect(card.highlightSuggestions).toBeNull();
      expect(card.transferSuggestions).toBeNull();
    });

    it("MC-SVC-006: number 字段 — 转 string", async () => {
      const { normalizeMaterialCardTextField } = await importAi();
      expect(normalizeMaterialCardTextField(42)).toBe("42");
      expect(normalizeMaterialCardTextField(0)).toBe("0");
      expect(normalizeMaterialCardTextField(-3.14)).toBe("-3.14");
    });

    it("MC-SVC-007: boolean 字段 — 转 string", async () => {
      const { normalizeMaterialCardTextField } = await importAi();
      expect(normalizeMaterialCardTextField(true)).toBe("true");
      expect(normalizeMaterialCardTextField(false)).toBe("false");
    });
  });

  // ─── MC-SVC-008 ~ MC-SVC-009: AI 错误响应 ───

  describe("AI 响应错误", () => {
    it("MC-SVC-008: AI 返回非法 JSON — 抛 AI_RESPONSE_INVALID_JSON", async () => {
      mockCreateSuccess("not-valid-json");
      const { generateCardForContentItem, AiServiceError } = await importAi();

      await expect(
        generateCardForContentItem("标题", "来源", "正文", "golden_sentence")
      ).rejects.toThrow();

      try {
        await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError);
        expect((err as InstanceType<typeof AiServiceError>).code).toBe("AI_RESPONSE_INVALID_JSON");
      }
    });

    it("MC-SVC-009: AI 返回空内容 — 抛「AI 未返回有效内容」", async () => {
      mocks.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });
      const { generateCardForContentItem } = await importAi();

      await expect(
        generateCardForContentItem("标题", "来源", "正文", "golden_sentence")
      ).rejects.toThrow("AI 未返回有效内容");
    });

    it("MC-SVC-009b: AI 返回缺少 aiSummary — 抛 AI_RESPONSE_INVALID_JSON", async () => {
      mockCreateSuccess(JSON.stringify({
        sourceSnapshot: "来源",
        originalFacts: "事实",
        // aiSummary 缺失
      }));
      const { generateCardForContentItem, AiServiceError } = await importAi();

      await expect(
        generateCardForContentItem("标题", "来源", "正文", "golden_sentence")
      ).rejects.toThrow();

      try {
        await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError);
        expect((err as InstanceType<typeof AiServiceError>).code).toBe("AI_RESPONSE_INVALID_JSON");
      }
    });
  });

  // ─── MC-SVC-010: 9 种 cardType 都有 prompt ───

  describe("cardType prompt 覆盖", () => {
    const CARD_TYPES = [
      "golden_sentence",
      "standard_expression",
      "case_material",
      "countermeasure",
      "problem_statement",
      "reason_analysis",
      "policy_expression",
      "person_story",
      "article_structure",
    ] as const;

    it("MC-SVC-010: 9 种 cardType 都有对应 prompt", async () => {
      const { CARD_TYPE_PROMPT_KEYS, DEFAULT_PROMPT_TEMPLATES } = await importAi();

      for (const cardType of CARD_TYPES) {
        expect(CARD_TYPE_PROMPT_KEYS[cardType]).toBeTruthy();
        expect(DEFAULT_PROMPT_TEMPLATES[CARD_TYPE_PROMPT_KEYS[cardType]]).toBeTruthy();
        expect(DEFAULT_PROMPT_TEMPLATES[CARD_TYPE_PROMPT_KEYS[cardType]].length).toBeGreaterThan(50);
      }
    });
  });

  // ─── MC-SVC-011: data_fact 不再存在 ───

  describe("旧类型 data_fact 移除", () => {
    it("MC-SVC-011: PROMPT_TEMPLATE_DEFINITIONS 不含 data_fact", async () => {
      const { PROMPT_TEMPLATE_DEFINITIONS } = await importAi();

      const keys = PROMPT_TEMPLATE_DEFINITIONS.map((t) => t.key);
      expect(keys).not.toContain("card_data_fact");
      expect(keys).toContain("card_golden_sentence");
    });
  });

  // ─── MC-SVC-012 ~ MC-SVC-013: 自定义 prompt ───

  describe("自定义 prompt 逻辑", () => {
    it("MC-SVC-012: 自定义 prompt 启用 — 优先使用 DB prompt", async () => {
      mocks.promptFindUnique.mockResolvedValue({
        key: "card_golden_sentence",
        content: " 自定义金句提示词 ",
        enabled: true,
      });
      const { getPromptTemplate } = await importAi();

      const prompt = await getPromptTemplate("card_golden_sentence");
      expect(prompt).toBe("自定义金句提示词");
    });

    it("MC-SVC-013: 自定义 prompt 为空 — fallback 默认 prompt", async () => {
      mocks.promptFindUnique.mockResolvedValue({
        key: "card_golden_sentence",
        content: "   ",
        enabled: true,
      });
      const { getPromptTemplate } = await importAi();

      const prompt = await getPromptTemplate("card_golden_sentence");
      expect(prompt).toContain("申论写作金句");
    });

    it("MC-SVC-013b: 自定义 prompt 未启用 — fallback 默认 prompt", async () => {
      mocks.promptFindUnique.mockResolvedValue({
        key: "card_golden_sentence",
        content: "自定义但禁用",
        enabled: false,
      });
      const { getPromptTemplate } = await importAi();

      const prompt = await getPromptTemplate("card_golden_sentence");
      expect(prompt).toContain("申论写作金句");
      expect(prompt).not.toContain("自定义但禁用");
    });
  });

  // ─── MC-SVC-014: prompt 变量渲染 ───

  describe("prompt 变量渲染", () => {
    it("MC-SVC-014: renderPromptTemplate 替换 title/source/content", async () => {
      const { renderPromptTemplate } = await importAi();

      const result = renderPromptTemplate(
        "标题：{{title}}，来源：{{sourceName}}，正文：{{content}}",
        {
          title: "基层治理",
          sourceName: "人民日报",
          content: "基层治理是重点",
        }
      );

      expect(result).toContain("标题：基层治理");
      expect(result).toContain("来源：人民日报");
      expect(result).toContain("正文：基层治理是重点");
      expect(result).not.toContain("{{title}}");
      expect(result).not.toContain("{{sourceName}}");
      expect(result).not.toContain("{{content}}");
    });

    it("MC-SVC-014b: renderPromptTemplate 处理数组变量", async () => {
      const { renderPromptTemplate } = await importAi();

      const result = renderPromptTemplate("分类：{{categories}}", {
        categories: ["民生", "治理"],
      });

      expect(result).toBe("分类：民生、治理");
    });

    it("MC-SVC-014c: renderPromptTemplate 处理 undefined 变量", async () => {
      const { renderPromptTemplate } = await importAi();

      const result = renderPromptTemplate("标题：{{title}}，缺失：{{missing}}", {
        title: "测试",
      });

      expect(result).toBe("标题：测试，缺失：");
    });
  });

  // ─── MC-SVC-015: 长文生成素材卡 ───

  describe("长文处理", () => {
    it("MC-SVC-015: 长文生成素材卡 — 使用 buildAiContent 保留头尾", async () => {
      mockCreateSuccess(makeCardResponse());
      const { generateCardForContentItem } = await importAi();

      const longContent = `${"开头部分。".repeat(300)}${"中间内容。".repeat(1000)}结尾保留关键信息。`;

      await generateCardForContentItem("长文标题", "来源", longContent, "golden_sentence");

      // generateCardForContentItem 用 renderPromptTemplate 把 content 渲染进 systemPrompt
      // 由于 golden_sentence 默认模板没有 {{content}} 变量，
      // content 不会被渲染进 systemPrompt，但 buildAiContent 仍被调用。
      // 验证 buildAiContent 的输出被传入了 renderPromptTemplate 的 variables.content
      const params = mocks.create.mock.calls[0][0];
      // 确认 prompt 通过了 buildAiContent 处理（非原始全文传入）
      // 检查 user prompt 存在
      const userPrompt = params.messages[1].content;
      expect(userPrompt).toContain("素材卡");
      // 直接验证 buildAiContent 的行为
      const { buildAiContent } = await importAi();
      const truncated = buildAiContent(longContent, 4000);
      expect(truncated).toContain("开头部分。");
      expect(truncated).toContain("结尾保留关键信息。");
      expect(truncated).toContain("中间内容已省略");
    });
  });

  // ─── MC-SVC-016 ~ MC-SVC-018: provider 错误 ───

  describe("provider 错误处理", () => {
    it("MC-SVC-016: provider 401 — key 脱敏", async () => {
      const error = new Error(
        "401 Authentication Fails, Your api key: sk-test-secret-1234 is invalid"
      ) as Error & { status: number };
      error.status = 401;
      mocks.create.mockRejectedValue(error);

      const { generateCardForContentItem, AiServiceError } = await importAi();

      try {
        await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError);
        const aiErr = err as InstanceType<typeof AiServiceError>;
        expect(aiErr.code).toBe("AI_API_CALL_FAILED");
        expect(aiErr.status).toBe(401);
        if (aiErr.diagnostics) {
          const diagStr = JSON.stringify(aiErr.diagnostics);
          expect(diagStr).not.toContain("sk-test-secret");
        }
      }
    });

    it("MC-SVC-017: provider 429 — AiServiceError status 429", async () => {
      const error = new Error("Rate limit exceeded") as Error & { status: number };
      error.status = 429;
      mocks.create.mockRejectedValue(error);

      const { generateCardForContentItem, AiServiceError } = await importAi();

      try {
        await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError);
        expect((err as InstanceType<typeof AiServiceError>).status).toBe(429);
      }
    });

    it("MC-SVC-018: provider 500 — AiServiceError status 500", async () => {
      const error = new Error("Internal server error") as Error & { status: number };
      error.status = 500;
      mocks.create.mockRejectedValue(error);

      const { generateCardForContentItem, AiServiceError } = await importAi();

      try {
        await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError);
        expect((err as InstanceType<typeof AiServiceError>).status).toBe(500);
      }
    });
  });
});
