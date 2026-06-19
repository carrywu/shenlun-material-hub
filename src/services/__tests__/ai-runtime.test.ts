import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  decrypt: vi.fn((value: string) => value),
  openAiConstructor: vi.fn(),
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

    constructor(options: unknown) {
      mocks.openAiConstructor(options);
    }
  },
}));

async function importAi() {
  vi.resetModules();
  return import("../ai");
}

describe("AI runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_MODEL;
    process.env.AI_CONFIG_ENCRYPTION_KEY = "12345678901234567890123456789012";
    mocks.create.mockResolvedValue({ choices: [{ message: { content: "OK" } }] });
  });

  it("uses enabled database AiConfig before env and returns safe metadata", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "cfg-db",
      encryptedKey: "  sk-db-secret-1234  ",
      baseUrl: " https://api.deepseek.com/v1 ",
      model: " deepseek-v4-flash ",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    process.env.AI_API_KEY = "sk-env-secret-9999";

    const { getAiRuntime } = await importAi();
    const runtime = await getAiRuntime();

    expect(runtime.source).toBe("db");
    expect(runtime.model).toBe("deepseek-v4-flash");
    expect(runtime.baseURL).toBe("https://api.deepseek.com/v1");
    expect(runtime.keySuffix).toBe("****1234");
    expect(runtime.cacheKey).toBe("db:cfg-db:2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(runtime)).not.toContain("sk-db-secret");
    expect(mocks.openAiConstructor).toHaveBeenCalledWith({
      apiKey: "sk-db-secret-1234",
      baseURL: "https://api.deepseek.com/v1",
    });
  });

  it("P0-4: 无数据库 AiConfig 时不再 fallback 到 env，而是抛 AI_CONFIG_MISSING", async () => {
    mocks.findFirst.mockResolvedValue(null);
    process.env.AI_API_KEY = "  sk-env-secret-9999  ";
    process.env.AI_BASE_URL = " https://api.openai.com/v1 ";
    process.env.AI_MODEL = " gpt-4o-mini ";

    const { getAiRuntime, AiServiceError } = await importAi();
    await expect(getAiRuntime()).rejects.toMatchObject({
      code: "AI_CONFIG_MISSING",
    });
    // 确保 env key 没有被使用（不应构造 OpenAI client）
    expect(mocks.openAiConstructor).not.toHaveBeenCalled();
    // 引用 AiServiceError 避免 unused
    expect(AiServiceError).toBeDefined();
  });

  it("reuses the client for the same cacheKey and recreates it when updatedAt changes", async () => {
    const firstUpdatedAt = new Date("2026-01-01T00:00:00.000Z");
    const secondUpdatedAt = new Date("2026-01-02T00:00:00.000Z");
    mocks.findFirst
      .mockResolvedValueOnce({ id: "cfg", encryptedKey: "sk-one-1111", baseUrl: "https://api.example.com/v1", model: "model-a", updatedAt: firstUpdatedAt })
      .mockResolvedValueOnce({ id: "cfg", encryptedKey: "sk-one-1111", baseUrl: "https://api.example.com/v1", model: "model-a", updatedAt: firstUpdatedAt })
      .mockResolvedValueOnce({ id: "cfg", encryptedKey: "sk-two-2222", baseUrl: "https://api.example.com/v1", model: "model-a", updatedAt: secondUpdatedAt });

    const { getAiRuntime } = await importAi();
    const runtime1 = await getAiRuntime();
    const runtime2 = await getAiRuntime();
    const runtime3 = await getAiRuntime();

    expect(runtime2.client).toBe(runtime1.client);
    expect(runtime3.cacheKey).not.toBe(runtime1.cacheKey);
    expect(runtime3.client).not.toBe(runtime1.client);
    expect(runtime3.keySuffix).toBe("****2222");
    expect(mocks.openAiConstructor).toHaveBeenCalledTimes(2);
  });

  it("resetAiConfigCache forces a new client on the next call", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "cfg",
      encryptedKey: "sk-one-1111",
      baseUrl: "https://api.example.com/v1",
      model: "model-a",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { getAiRuntime, resetAiConfigCache } = await importAi();
    const runtime1 = await getAiRuntime();
    resetAiConfigCache();
    const runtime2 = await getAiRuntime();

    expect(runtime2.cacheKey).toBe(runtime1.cacheKey);
    expect(runtime2.client).not.toBe(runtime1.client);
    expect(mocks.openAiConstructor).toHaveBeenCalledTimes(2);
  });
});
