import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiConfigFindFirst: vi.fn(),
  promptFindUnique: vi.fn(),
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
    chat = { completions: { create: vi.fn() } };
  },
}));

async function importAi() {
  vi.resetModules();
  return import("../ai");
}

describe("AI prompt templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aiConfigFindFirst.mockResolvedValue(null);
    mocks.promptFindUnique.mockResolvedValue(null);
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
});
