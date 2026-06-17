import { http, HttpResponse } from "msw";
import { getAuthUser } from "./auth";

/**
 * Material Cards API mock handlers.
 * Covers: /api/material-cards, /api/search, /api/review, /api/export
 */

// ─── Shared fixtures ───

const MOCK_CARD = {
  id: "mock-card-1",
  contentItemId: "mock-article-1",
  cardType: "golden_sentence",
  title: "基层治理金句",
  sourceSnapshot: "《党建引领基层治理新实践》— 人民日报",
  originalFacts: "某市在120个社区推行'红色物业'模式，惠及15万群众",
  aiSummary: "基层治理案例，体现党建引领优势",
  highlightSuggestions: "民有所呼、我有所应",
  transferSuggestions: "适用于基层治理、党建引领等主题",
  confirmed: true,
  archivedAt: null,
  createdAt: "2026-06-15T11:00:00Z",
  contentItem: {
    id: "mock-article-1",
    title: "党建引领基层治理新实践",
    source: { name: "人民日报" },
  },
};

const MOCK_CARD_2 = {
  id: "mock-card-2",
  contentItemId: "mock-article-1",
  cardType: "case_material",
  title: "基层治理案例",
  sourceSnapshot: "《党建引领基层治理新实践》— 人民日报",
  originalFacts: "主体：某市；做法：红色物业+数字化平台；成效：惠及15万群众",
  aiSummary: "党建创新案例",
  highlightSuggestions: "网格化管理、数字化平台",
  transferSuggestions: "适用于创新治理、数字化转型等主题",
  confirmed: false,
  archivedAt: null,
  createdAt: "2026-06-15T12:00:00Z",
  contentItem: {
    id: "mock-article-1",
    title: "党建引领基层治理新实践",
    source: { name: "人民日报" },
  },
};

const CARDS_LIST = [MOCK_CARD, MOCK_CARD_2];

// ─── Handlers ───

export const cardsHandlers = [
  // GET /api/material-cards
  http.get("/api/material-cards", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const cardType = url.searchParams.get("cardType") || "";
    const confirmed = url.searchParams.get("confirmed") || "";
    const search = url.searchParams.get("search") || "";

    let filtered = CARDS_LIST.filter((c) => !c.archivedAt);
    if (cardType) filtered = filtered.filter((c) => c.cardType === cardType);
    if (confirmed === "true") filtered = filtered.filter((c) => c.confirmed);
    if (confirmed === "false") filtered = filtered.filter((c) => !c.confirmed);
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.title.includes(search) ||
          c.sourceSnapshot.includes(search) ||
          c.aiSummary.includes(search)
      );
    }

    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      data,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
    });
  }),

  // POST /api/material-cards
  http.post("/api/material-cards", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    const newCard = {
      id: `mock-card-${Date.now()}`,
      contentItemId: body.contentItemId || "mock-article-1",
      cardType: body.cardType || "golden_sentence",
      title: body.title || "新建素材卡",
      sourceSnapshot: body.sourceSnapshot || "",
      originalFacts: body.originalFacts || "",
      aiSummary: body.aiSummary || "",
      highlightSuggestions: body.highlightSuggestions || "",
      transferSuggestions: body.transferSuggestions || "",
      confirmed: false,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json(newCard, { status: 201 });
  }),

  // GET /api/material-cards/:id
  http.get("/api/material-cards/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const card = CARDS_LIST.find((c) => c.id === params.id);
    if (!card) {
      return HttpResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }
    return HttpResponse.json({ ...card, syncRecords: [] });
  }),

  // PUT /api/material-cards/:id
  http.put("/api/material-cards/:id", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const card = CARDS_LIST.find((c) => c.id === params.id);
    if (!card) {
      return HttpResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...card, ...body });
  }),

  // DELETE /api/material-cards/:id (soft-delete = archive)
  http.delete("/api/material-cards/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    return HttpResponse.json({
      success: true,
      message: "素材卡已归档",
    });
  }),

  // PATCH /api/material-cards/:id
  http.patch("/api/material-cards/:id", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const card = CARDS_LIST.find((c) => c.id === params.id);
    if (!card) {
      return HttpResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }
    if (body.action === "archive") {
      return HttpResponse.json({ ...card, archivedAt: new Date().toISOString() });
    }
    if (body.action === "unarchive") {
      return HttpResponse.json({ ...card, archivedAt: null });
    }
    return HttpResponse.json(card);
  }),

  // GET /api/search
  http.get("/api/search", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    let filtered = CARDS_LIST.filter((c) => !c.archivedAt && c.confirmed);
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.title.includes(q) ||
          c.sourceSnapshot.includes(q) ||
          c.aiSummary.includes(q) ||
          c.originalFacts.includes(q) ||
          c.highlightSuggestions.includes(q) ||
          c.transferSuggestions.includes(q)
      );
    }

    return HttpResponse.json({
      data: filtered,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
      query: q,
    });
  }),

  // GET /api/review
  http.get("/api/review", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "random";
    const limit = parseInt(url.searchParams.get("limit") || "5");

    const unconfirmed = CARDS_LIST.filter((c) => !c.confirmed && !c.archivedAt);
    return HttpResponse.json({
      data: unconfirmed.slice(0, limit),
      mode,
    });
  }),

  // POST /api/review (confirm card)
  http.post("/api/review", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      card: { id: body.cardId, confirmed: true },
    });
  }),

  // GET /api/export
  http.get("/api/export", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    // Return a simple markdown export
    const markdown = `# 申论素材导出\n\n## 基层治理金句\n\n- 来源：《党建引领基层治理新实践》— 人民日报\n- 原文事实：某市在120个社区推行'红色物业'模式，惠及15万群众\n- 亮点：民有所呼、我有所应\n- 迁移建议：适用于基层治理、党建引领等主题\n`;
    return new HttpResponse(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }),
];
