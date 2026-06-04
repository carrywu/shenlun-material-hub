import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  createCard: vi.fn(),
  updateContent: vi.fn(),
  generateCardForContentItem: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
      update: mocks.updateContent,
    },
    materialCard: {
      findFirst: mocks.findFirst,
      create: mocks.createCard,
    },
  },
}));

vi.mock("@/services/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ai")>();
  return {
    AiServiceError: actual.AiServiceError,
    generateCardForContentItem: mocks.generateCardForContentItem,
  };
});

describe("POST /api/content-items/[id]/generate-card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "article-1",
      title: "测试文章",
      fullText: "正文",
      aiDecision: "accept",
      aiReason: null,
      source: { name: "来源" },
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateContent.mockResolvedValue({});
  });

  it("returns structured diagnostics when AI provider returns 401", async () => {
    const { AiServiceError } = await import("@/services/ai");
    mocks.generateCardForContentItem.mockRejectedValue(new AiServiceError(
      "AI_API_CALL_FAILED",
      "AI 请求失败",
      401,
      {
        status: 401,
        source: "db",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        keySuffix: "****1234",
      }
    ));
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
      method: "POST",
      body: JSON.stringify({ cardType: "golden_sentence" }),
    }), { params: Promise.resolve({ id: "article-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: "AI_API_CALL_FAILED",
      message: "AI 请求失败",
      status: 401,
      source: "db",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      keySuffix: "****1234",
    });
    expect(payload).toHaveProperty("requestId");
    expect(JSON.stringify(payload)).not.toContain("sk-");
  });

  it("returns a clear error when full text is missing", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "article-1",
      title: "测试文章",
      fullText: null,
      aiDecision: "accept",
      aiReason: null,
      source: { name: "来源" },
    });
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
      method: "POST",
      body: JSON.stringify({ cardType: "golden_sentence" }),
    }), { params: Promise.resolve({ id: "article-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "NO_FULL_TEXT", message: "该内容条目没有全文，无法生成素材卡" });
  });

  it("rejects data_fact as a new material card type", async () => {
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
      method: "POST",
      body: JSON.stringify({ cardType: "data_fact" }),
    }), { params: Promise.resolve({ id: "article-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("无效的卡片类型");
    expect(payload.message).not.toContain("data_fact");
    expect(mocks.generateCardForContentItem).not.toHaveBeenCalled();
  });
});
