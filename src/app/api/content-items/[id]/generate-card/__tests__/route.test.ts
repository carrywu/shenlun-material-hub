import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  createAsyncTask: vi.fn(),
  enqueueAsyncTask: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
    },
    materialCard: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/async-task", () => ({
  createAsyncTask: mocks.createAsyncTask,
  enqueueAsyncTask: mocks.enqueueAsyncTask,
}));

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
    mocks.createAsyncTask.mockResolvedValue({ id: "task-1", type: "CARD_GENERATE" });
  });

  it("queues background generation and returns 202", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      accepted: true,
      taskId: "task-1",
      status: "PENDING",
      contentItemId: "article-1",
      cardType: "golden_sentence",
    });
    expect(mocks.createAsyncTask).toHaveBeenCalledWith(
      "CARD_GENERATE",
      expect.objectContaining({
        contentItemId: "article-1",
        cardType: "golden_sentence",
      })
    );
    expect(mocks.enqueueAsyncTask).toHaveBeenCalledTimes(1);
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

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "golden_sentence" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "NO_FULL_TEXT", message: "该内容条目没有全文，无法生成素材卡" });
  });

  it("rejects data_fact as a new material card type", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new NextRequest("http://localhost/api/content-items/article-1/generate-card", {
        method: "POST",
        body: JSON.stringify({ cardType: "data_fact" }),
      }),
      { params: Promise.resolve({ id: "article-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("无效的卡片类型");
    expect(payload.message).not.toContain("data_fact");
    expect(mocks.enqueueAsyncTask).not.toHaveBeenCalled();
  });
});
