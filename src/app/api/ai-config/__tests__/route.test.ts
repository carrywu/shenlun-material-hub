import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
  decrypt: vi.fn((value: string) => value),
  resetAiConfigCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiConfig: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      create: mocks.create,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: mocks.encrypt,
  decrypt: mocks.decrypt,
  hasEncryptionKey: vi.fn(() => true),
}));

vi.mock("@/services/ai", () => ({
  resetAiConfigCache: mocks.resetAiConfigCache,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
}));

describe("/api/ai-config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets AI runtime cache after POST saves a config", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "cfg" });
    const { POST } = await import("../route");

    const response = await POST(new NextRequest("http://localhost/api/ai-config", {
      method: "POST",
      body: JSON.stringify({ apiKey: " sk-test-1234 ", baseUrl: " https://api.example.com/v1 ", model: " model-a " }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "user-admin-1",
        userId: "admin-1",
        encryptedKey: "encrypted:sk-test-1234",
        baseUrl: "https://api.example.com/v1",
        model: "model-a",
      }),
    }));
    expect(mocks.resetAiConfigCache).toHaveBeenCalledTimes(1);
  });

  it("resets AI runtime cache after DELETE removes configs", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("../route");

    const response = await DELETE(new NextRequest("http://localhost/api/ai-config", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin-1" } });
    expect(mocks.resetAiConfigCache).toHaveBeenCalledTimes(1);
  });
});
