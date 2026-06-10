import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiConfigFindFirst: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiConfig: {
      findFirst: mocks.aiConfigFindFirst,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: mocks.decrypt,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Prevent OpenAI constructor from making real calls
vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

describe("AI config missing — friendly Chinese error messages", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Reset the module cache so getAiRuntime picks up fresh env vars
    vi.resetModules();
  });

  it("throws AiServiceError with Chinese message when user has no AI config in DB", async () => {
    mocks.aiConfigFindFirst.mockResolvedValue(null);
    // No env fallback either
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { getAiRuntime, AiServiceError } = await import("../ai");

    try {
      await getAiRuntime("user-123");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AiServiceError);
      const err = error as InstanceType<typeof AiServiceError>;
      expect(err.code).toBe("AI_CONFIG_MISSING");
      // Must be a friendly Chinese message, NOT raw error like "Cannot read properties of undefined"
      expect(err.message).toContain("AI");
      expect(err.message).not.toContain("Cannot read properties");
      expect(err.message).not.toContain("undefined");
      expect(err.message).not.toContain("null");
    }
  });

  it("throws AiServiceError with Chinese message when global config missing and no env fallback", async () => {
    // DB returns no config
    mocks.aiConfigFindFirst.mockResolvedValue(null);
    // No env fallback
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { getAiRuntime, AiServiceError } = await import("../ai");

    try {
      await getAiRuntime(); // no userId → global config path
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AiServiceError);
      const err = error as InstanceType<typeof AiServiceError>;
      expect(err.code).toBe("AI_CONFIG_MISSING");
      expect(err.message).toContain("AI");
      expect(err.message).not.toContain("Cannot read properties");
      expect(err.message).not.toContain("undefined");
    }
  });

  it("throws AiServiceError when user config exists but API key is empty after decryption", async () => {
    mocks.aiConfigFindFirst.mockResolvedValue({
      id: "config-1",
      encryptedKey: "encrypted-value",
      baseUrl: "https://api.example.com",
      model: "deepseek-chat",
      updatedAt: new Date(),
    });
    mocks.decrypt.mockReturnValue("   "); // whitespace-only key
    process.env.AI_CONFIG_ENCRYPTION_KEY = "test-key";

    const { getAiRuntime, AiServiceError } = await import("../ai");

    try {
      await getAiRuntime("user-123");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AiServiceError);
      const err = error as InstanceType<typeof AiServiceError>;
      expect(err.code).toBe("AI_CONFIG_MISSING");
      expect(err.message).toContain("API Key");
      expect(err.message).not.toContain("Cannot read properties");
    }
  });
});
