import { http, HttpResponse, delay } from "msw";
import { getAuthUser } from "./auth";

/**
 * AI API mock handlers with configurable scenarios.
 * Covers: /api/ai-config, /api/settings/ai-config, /api/ai-config/test, /api/ai-config/prompts
 *
 * Usage in tests:
 *   server.use(aiScenario.invalidJson)  — returns malformed JSON
 *   server.use(aiScenario.rateLimited429) — returns 429
 *   etc.
 */

// ─── AI Config fixture ───

const MOCK_AI_CONFIG = {
  configured: true,
  id: "mock-ai-config-id",
  name: "DeepSeek v4 Flash",
  baseUrl: "https://api.deepseek.com",
  maskedKey: "sk-****adfe",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  isEnabled: true,
  lastTestedAt: "2026-06-15T10:00:00Z",
  lastTestError: null,
};

const MOCK_PROMPTS = [
  {
    key: "article_evaluation",
    name: "文章评估",
    description: "评估文章是否适合申论素材",
    content: "你是一位申论素材评估专家...",
    defaultContent: "你是一位申论素材评估专家...",
    enabled: true,
    version: 1,
    customized: false,
    updatedAt: "2026-06-15T10:00:00Z",
  },
  {
    key: "card_golden_sentence",
    name: "素材卡-金句",
    description: "从文章中提取金句素材卡",
    content: "从以下文章中提取金句...",
    defaultContent: "从以下文章中提取金句...",
    enabled: true,
    version: 1,
    customized: false,
    updatedAt: "2026-06-15T10:00:00Z",
  },
  {
    key: "card_case_material",
    name: "素材卡-案例",
    description: "从文章中提取案例素材卡",
    content: "从以下文章中提取案例...",
    defaultContent: "从以下文章中提取案例...",
    enabled: true,
    version: 1,
    customized: false,
    updatedAt: "2026-06-15T10:00:00Z",
  },
];

// ─── Handlers ───

export const aiHandlers = [
  // GET /api/ai-config
  http.get("/api/ai-config", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json(MOCK_AI_CONFIG);
  }),

  // POST /api/ai-config
  http.post("/api/ai-config", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    // Accept any config update
    return HttpResponse.json({ success: true });
  }),

  // DELETE /api/ai-config
  http.delete("/api/ai-config", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true });
  }),

  // GET /api/ai-config/prompts
  http.get("/api/ai-config/prompts", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ templates: MOCK_PROMPTS });
  }),

  // PUT /api/ai-config/prompts
  http.put("/api/ai-config/prompts", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true });
  }),

  // POST /api/ai-config/prompts (reset)
  http.post("/api/ai-config/prompts", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true });
  }),

  // POST /api/ai-config/test
  http.post("/api/ai-config/test", async () => {
    const auth = getAuthUser();
    if (!auth || (auth.role !== "ADMIN" && auth.role !== "VERIFIED_USER")) {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      success: true,
      model: "deepseek-v4-flash",
      latencyMs: 245,
      tokensUsed: 156,
    });
  }),

  // GET /api/settings/ai-config
  http.get("/api/settings/ai-config", () => {
    const auth = getAuthUser();
    if (!auth || (auth.role !== "ADMIN" && auth.role !== "VERIFIED_USER")) {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      configured: true,
      id: MOCK_AI_CONFIG.id,
      name: MOCK_AI_CONFIG.name,
      baseUrl: MOCK_AI_CONFIG.baseUrl,
      maskedKey: MOCK_AI_CONFIG.maskedKey,
      model: MOCK_AI_CONFIG.model,
      temperature: MOCK_AI_CONFIG.temperature,
      isEnabled: MOCK_AI_CONFIG.isEnabled,
    });
  }),
];

// ─── AI Error Scenarios (use via server.use()) ───

export const aiScenario = {
  /** AI returns invalid JSON */
  invalidJson: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          message: { content: "This is not JSON at all {broken" },
          finish_reason: "stop",
        },
      ],
    });
  }),

  /** AI returns valid JSON accepting the article */
  accept: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          message: {
            content: JSON.stringify({
              decision: "accept",
              contentGenre: "case_practice",
              reason: "基层治理案例有素材价值",
              categories: ["基层治理"],
              usableFor: ["大作文"],
              quotes: ["只有把党的组织优势转化为治理优势"],
              summary: "某市探索党建引领基层治理新模式",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });
  }),

  /** AI returns valid JSON rejecting the article */
  reject: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          message: {
            content: JSON.stringify({
              decision: "reject",
              contentGenre: "meeting_news",
              reason: "会议新闻无素材价值",
              categories: [],
              usableFor: [],
              quotes: [],
              summary: "",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });
  }),

  /** AI returns empty content */
  emptyContent: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
    });
  }),

  /** AI returns 401 Unauthorized */
  unauthorized401: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json(
      { error: { message: "Incorrect API key provided", type: "invalid_request_error" } },
      { status: 401 }
    );
  }),

  /** AI returns 429 Rate Limited */
  rateLimited429: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json(
      { error: { message: "Rate limit reached", type: "rate_limit_error" } },
      { status: 429 }
    );
  }),

  /** AI returns 500 Server Error */
  serverError500: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json(
      { error: { message: "Internal server error", type: "server_error" } },
      { status: 500 }
    );
  }),

  /** AI times out (delays 30s) */
  timeout: http.post("*/v1/chat/completions", async () => {
    await delay("infinite");
    return new HttpResponse(null, { status: 504 });
  }),

  /** AI returns JSON with missing required fields */
  missingFields: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          message: {
            content: JSON.stringify({
              decision: "accept",
              // Missing: contentGenre, reason, categories, etc.
            }),
          },
          finish_reason: "stop",
        },
      ],
    });
  }),

  /** AI returns markdown-wrapped JSON (```json ... ```) */
  markdownJson: http.post("*/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          message: {
            content: '```json\n{"decision":"accept","contentGenre":"case_practice","reason":"有素材价值","categories":["基层治理"],"usableFor":["大作文"],"quotes":["治理之道"],"summary":""}\n```',
          },
          finish_reason: "stop",
        },
      ],
    });
  }),

  /** AI config test returns failure */
  testFailed: http.post("/api/ai-config/test", () => {
    return HttpResponse.json({
      success: false,
      error: "Connection refused: API base URL unreachable",
    });
  }),

  /** AI config is not configured */
  notConfigured: http.get("/api/ai-config", () => {
    return HttpResponse.json({ configured: false });
  }),
};
