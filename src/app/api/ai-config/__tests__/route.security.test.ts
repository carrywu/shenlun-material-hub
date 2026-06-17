import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * §P1-4 AI 配置安全 Route 测试
 * 覆盖 AIC-001 到 AIC-018
 */

// ─── Shared mocks ───

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
  decrypt: vi.fn((value: string) => value),
  hasEncryptionKey: vi.fn(() => true),
  resetAiConfigCache: vi.fn(),
  testAiConfig: vi.fn(),
  requireAdmin: vi.fn(),
  requireVerifiedUser: vi.fn(),
  unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
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
  hasEncryptionKey: mocks.hasEncryptionKey,
}));

vi.mock("@/services/ai", () => ({
  resetAiConfigCache: mocks.resetAiConfigCache,
  testAiConfig: mocks.testAiConfig,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireVerifiedUser: mocks.requireVerifiedUser,
  unauthorizedResponse: mocks.unauthorizedResponse,
  forbiddenResponse: mocks.forbiddenResponse,
}));

const ADMIN_USER = { id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" };
const VERIFIED_USER = { id: "verified-1", username: "verified", role: "VERIFIED_USER", status: "ACTIVE" };
const NORMAL_USER = { id: "user-1", username: "user", role: "USER", status: "ACTIVE" };

function makeRequest(method: string, url: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

// ─── AIC-001 to AIC-009: GET /api/ai-config ───

describe("AI 配置 GET — AIC-001 ~ AIC-009", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AIC-001: 未登录 GET → 401", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET", "http://localhost/api/ai-config"));
    expect(res.status).toBe(401);
  });

  it("AIC-002: 未登录 POST → 401", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "https://api.test.com", model: "test",
    }));
    expect(res.status).toBe(401);
  });

  it("AIC-003: USER GET → 403（非管理员）", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    // Simulate cookie present but wrong role
    mocks.unauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    );
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/ai-config", {
      headers: { cookie: "auth_token=fake" },
    });
    const res = await GET(req);
    // requireAdmin returns null + cookie present → forbiddenResponse
    expect(res.status).toBe(403);
  });

  it("AIC-004: ADMIN GET → 200", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", baseUrl: "https://api.test.com", encryptedKey: "enc", model: "test", temperature: 0.3, isEnabled: true, lastTestedAt: null, lastTestError: null, name: "user-admin-1",
    });
    mocks.decrypt.mockReturnValue("sk-1234567890");
    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET", "http://localhost/api/ai-config"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
  });

  it("AIC-007: GET 不返回完整 key — 只返回 masked", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", baseUrl: "https://api.test.com", encryptedKey: "enc", model: "test", temperature: 0.3, isEnabled: true, name: "cfg",
    });
    mocks.decrypt.mockReturnValue("sk-1234567890abcdef");
    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET", "http://localhost/api/ai-config"));
    const body = await res.json();
    expect(body.maskedKey).toBe("sk-1****");
    expect(body.maskedKey).not.toContain("1234567890abcdef");
  });

  it("AIC-017: 解密失败 → maskedKey 为 ****", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", baseUrl: "https://api.test.com", encryptedKey: "bad-enc", model: "test", temperature: 0.3, isEnabled: true, name: "cfg",
    });
    mocks.decrypt.mockImplementation(() => { throw new Error("解密失败"); });
    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET", "http://localhost/api/ai-config"));
    const body = await res.json();
    expect(body.maskedKey).toBe("****");
  });
});

// ─── AIC-005 ~ AIC-011: POST /api/ai-config ───

describe("AI 配置 POST — AIC-005 ~ AIC-011, AIC-018", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AIC-005: ADMIN 保存配置 → 200", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "cfg-new" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test-1234", baseUrl: "https://api.example.com/v1", model: "model-a",
    }));
    expect(res.status).toBe(200);
    expect(mocks.resetAiConfigCache).toHaveBeenCalledTimes(1);
  });

  it("AIC-006: API Key 保存后加密 — DB 存 encryptedKey", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "cfg-new" });
    const { POST } = await import("../route");
    await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test-1234", baseUrl: "https://api.example.com/v1", model: "model-a",
    }));
    expect(mocks.encrypt).toHaveBeenCalledWith("sk-test-1234");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ encryptedKey: "encrypted:sk-test-1234" }),
    }));
  });

  it("AIC-008: baseURL 为空 → 使用默认", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "cfg-new" });
    const { POST } = await import("../route");
    await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "", model: "test",
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baseUrl: "https://api.deepseek.com/v1" }),
    }));
  });

  it("AIC-009: model 为空 → 使用默认", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "cfg-new" });
    const { POST } = await import("../route");
    await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "https://api.test.com", model: "",
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ model: "deepseek-v4-flash" }),
    }));
  });

  it("AIC-010: temperature < 0 → 400", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "https://api.test.com", model: "test", temperature: -0.5,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("temperature");
  });

  it("AIC-011: temperature > 2 → 400", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "https://api.test.com", model: "test", temperature: 3.0,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("temperature");
  });

  it("AIC-018: AI_CONFIG_ENCRYPTION_KEY 缺失 → 503 + 中文错误", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.hasEncryptionKey.mockReturnValue(false);
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config", {
      apiKey: "sk-test", baseUrl: "https://api.test.com", model: "test",
    }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("加密密钥");
  });

  it("AIC-016: DELETE 删除配置 → 缓存清空", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN_USER);
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", "http://localhost/api/ai-config"));
    expect(res.status).toBe(200);
    expect(mocks.resetAiConfigCache).toHaveBeenCalledTimes(1);
  });
});

// ─── AIC-012 ~ AIC-015: POST /api/ai-config/test ───

describe("AI 配置连接测试 — AIC-012 ~ AIC-015", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AIC-012: 测试连接成功 → 中文成功", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", userId: "admin-1", isEnabled: true,
    });
    mocks.testAiConfig.mockResolvedValue({ success: true, error: null });
    mocks.update.mockResolvedValue({ id: "cfg-1" });
    const { POST } = await import("../test/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config/test"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("AIC-013: 测试连接 401 → 中文失败 + key 脱敏", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", userId: "admin-1", isEnabled: true,
    });
    mocks.testAiConfig.mockResolvedValue({
      success: false, error: "API Key 无效或已过期",
    });
    mocks.update.mockResolvedValue({ id: "cfg-1" });
    const { POST } = await import("../test/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config/test"));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("无效");
  });

  it("AIC-014: 测试连接 429 → 中文限流", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", userId: "admin-1", isEnabled: true,
    });
    mocks.testAiConfig.mockResolvedValue({
      success: false, error: "请求过于频繁，请稍后重试",
    });
    mocks.update.mockResolvedValue({ id: "cfg-1" });
    const { POST } = await import("../test/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config/test"));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("频繁");
  });

  it("AIC-015: 测试连接 timeout → 中文超时", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN_USER);
    mocks.findFirst.mockResolvedValue({
      id: "cfg-1", userId: "admin-1", isEnabled: true,
    });
    mocks.testAiConfig.mockResolvedValue({
      success: false, error: "连接超时，请检查 API 地址是否正确",
    });
    mocks.update.mockResolvedValue({ id: "cfg-1" });
    const { POST } = await import("../test/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/ai-config/test"));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("超时");
  });
});
