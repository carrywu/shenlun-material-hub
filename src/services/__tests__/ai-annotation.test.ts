import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    aiConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((val: string) => val),
}));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    comment: "这是一个好的论点",
                    highlight: true,
                    tags: ["论点", "写作技巧"],
                  }),
                },
              },
            ],
          }),
        },
      };
    },
  };
});

describe("ai-annotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateAnnotation returns structured result", async () => {
    const { generateAnnotation } = await import("../ai-annotation");
    const result = await generateAnnotation(
      "测试文章标题",
      "测试文章内容",
      "选中的文本"
    );

    expect(result).toHaveProperty("comment");
    expect(result).toHaveProperty("highlight");
    expect(result).toHaveProperty("tags");
    expect(typeof result.comment).toBe("string");
    expect(typeof result.highlight).toBe("boolean");
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it("autoAnnotateArticle returns array of annotations", async () => {
    const { autoAnnotateArticle } = await import("../ai-annotation");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              annotations: [
                {
                  selectedText: "测试文本",
                  paragraph: 0,
                  comment: "测试批注",
                  tags: ["标签1"],
                },
              ],
            }),
          },
        },
      ],
    });

    const openai = await import("openai");
    const instance = new openai.default();
    (instance.chat.completions.create as ReturnType<typeof vi.fn>) = mockCreate;

    const result = await autoAnnotateArticle(
      "article-1",
      "测试文章",
      "测试内容"
    );

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("selectedText");
      expect(result[0]).toHaveProperty("comment");
      expect(result[0]).toHaveProperty("tags");
    }
  });
});
