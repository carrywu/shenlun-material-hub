import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiPromptTemplate: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
      update: mocks.update,
    },
  },
}));

describe("/api/ai-config/prompts route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("lists prompt templates without data_fact", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.templates.some((template: { key: string }) => template.key === "article_evaluation")).toBe(true);
    expect(payload.templates.some((template: { key: string }) => template.key === "card_data_fact")).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("数据事实");
  });

  it("rejects empty custom prompt content", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(new NextRequest("http://localhost/api/ai-config/prompts", {
      method: "PUT",
      body: JSON.stringify({ key: "card_golden_sentence", content: "   " }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("提示词内容不能为空");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("saves custom prompt content by key", async () => {
    mocks.upsert.mockResolvedValue({});
    const { PUT } = await import("../route");

    const response = await PUT(new NextRequest("http://localhost/api/ai-config/prompts", {
      method: "PUT",
      body: JSON.stringify({ key: "card_golden_sentence", content: "新的提示词" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "card_golden_sentence" },
      update: expect.objectContaining({ content: "新的提示词" }),
    }));
  });

  it("restores a prompt to its default content", async () => {
    mocks.upsert.mockResolvedValue({});
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/ai-config/prompts", {
      method: "POST",
      body: JSON.stringify({ key: "card_golden_sentence" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "card_golden_sentence" },
      update: expect.objectContaining({
        content: expect.stringContaining("申论写作金句"),
      }),
    }));
  });
});
