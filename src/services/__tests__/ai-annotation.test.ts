import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/services/ai", () => ({
  getAiRuntime: vi.fn(async () => ({
    client: { chat: { completions: { create: mocks.create } } },
    model: "mock-model",
    source: "env",
    keySuffix: "****1234",
    cacheKey: "env:test",
  })),
}));

describe("ai-annotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({
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
    });
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
    mocks.create.mockResolvedValue({
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

    const { autoAnnotateArticle } = await import("../ai-annotation");
    const result = await autoAnnotateArticle(
      "article-1",
      "测试文章",
      "测试内容"
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("selectedText");
    expect(result[0]).toHaveProperty("comment");
    expect(result[0]).toHaveProperty("tags");
  });
});
