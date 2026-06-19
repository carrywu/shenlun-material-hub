import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  decrypt: vi.fn((value: string) => value),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiConfig: {
      findFirst: mocks.findFirst,
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

describe("material card generation normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // P0-4 后不再 env fallback，统一喂 DB 全局配置 + 加密 key + 重置 decrypt 实现
    mocks.findFirst.mockResolvedValue({
      id: "cfg-default",
      encryptedKey: "sk-test-1234",
      baseUrl: "https://api.test.com/v1",
      model: "test-model",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.decrypt.mockImplementation((value: string) => value);
    process.env.AI_CONFIG_ENCRYPTION_KEY = "12345678901234567890123456789012";
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
  });

  it("keeps string fields as strings without double JSON stringifying", async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sourceSnapshot: "来源", originalFacts: "事实", aiSummary: "摘要", highlightSuggestions: "亮点", transferSuggestions: "迁移" }) } }],
    });

    const { generateCardForContentItem } = await importAi();
    const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");

    expect(card.originalFacts).toBe("事实");
    expect(card.originalFacts).not.toBe('"事实"');
  });

  it("converts object fields into JSON strings", async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sourceSnapshot: { title: "标题" }, originalFacts: { facts: ["A"] }, aiSummary: "摘要", highlightSuggestions: { tips: ["T"] }, transferSuggestions: "迁移" }) } }],
    });

    const { generateCardForContentItem } = await importAi();
    const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");

    expect(card.originalFacts).toContain('"facts"');
    expect(JSON.parse(card.originalFacts ?? "{}")).toEqual({ facts: ["A"] });
  });

  it("converts array fields into JSON strings", async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sourceSnapshot: ["来源"], originalFacts: ["事实1", "事实2"], aiSummary: "摘要", highlightSuggestions: ["亮点"], transferSuggestions: ["迁移"] }) } }],
    });

    const { generateCardForContentItem } = await importAi();
    const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");

    expect(JSON.parse(card.originalFacts ?? "[]")).toEqual(["事实1", "事实2"]);
  });

  it("converts null and undefined optional fields into null", async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sourceSnapshot: null, originalFacts: null, aiSummary: "摘要" }) } }],
    });

    const { generateCardForContentItem } = await importAi();
    const card = await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");

    expect(card.sourceSnapshot).toBeNull();
    expect(card.originalFacts).toBeNull();
    expect(card.highlightSuggestions).toBeNull();
    expect(card.transferSuggestions).toBeNull();
  });

  it("wraps provider 401 with structured safe diagnostics", async () => {
    const error = new Error("401 Authentication Fails, Your api key: sk-test-secret-1234 is invalid") as Error & { status: number };
    error.status = 401;
    mocks.create.mockRejectedValue(error);

    const { generateCardForContentItem, AiServiceError } = await importAi();

    await expect(generateCardForContentItem("标题", "来源", "正文", "golden_sentence")).rejects.toMatchObject({
      code: "AI_API_CALL_FAILED",
      status: 401,
      // P0-4 后 runtime 来自 DB 全局配置（source: "db"），不再 env fallback
      diagnostics: expect.objectContaining({ source: "db", keySuffix: "****1234", status: 401 }),
    });

    try {
      await generateCardForContentItem("标题", "来源", "正文", "golden_sentence");
    } catch (err) {
      expect(err).toBeInstanceOf(AiServiceError);
      expect(JSON.stringify((err as Error & { diagnostics?: unknown }).diagnostics)).not.toContain("sk-test-secret");
    }
  });

  it("builds long AI content from the head and tail instead of only the head", async () => {
    const { buildAiContent } = await importAi();
    const content = `${"A".repeat(3000)}${"M".repeat(3000)}TAIL-END`;

    const result = buildAiContent(content, 4000);

    expect(result.length).toBeLessThanOrEqual(4020);
    expect(result).toContain("A".repeat(100));
    expect(result).toContain("TAIL-END");
    expect(result).toContain("中间内容已省略");
  });
});
