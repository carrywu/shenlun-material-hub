import { http, HttpResponse, delay } from "msw";
import { getAuthUser } from "./auth";

/**
 * Articles & Content Items API mock handlers.
 * Covers: /api/articles, /api/content-items, /api/discover, /api/explore
 */

// ─── Shared fixtures ───

const MOCK_ARTICLE = {
  id: "mock-article-1",
  title: "党建引领基层治理新实践",
  originalUrl: "https://example.com/article-1",
  sourceId: "mock-source-1",
  source: { id: "mock-source-1", name: "人民日报", platform: "wechat_mp" },
  fullText: "某市积极探索党建引领基层治理新模式，通过网格化管理、数字化平台、群众议事机制三大抓手，有效提升了基层治理效能。",
  excerpt: "党建引领基层治理新实践",
  contentType: "article",
  qualityStatus: "approved",
  aiDecision: "accept",
  aiScore: 85,
  aiScoredAt: "2026-06-15T10:00:00Z",
  publishedAt: "2026-06-15T08:00:00Z",
  createdAt: "2026-06-15T09:00:00Z",
  wordCount: 320,
  effectiveTextLength: 280,
  topicTags: ["基层治理", "党建引领"],
  regionScopes: ["全国"],
  _count: { materialCards: 2 },
  userRead: false,
  userIgnored: false,
  userBookmarked: false,
};

const MOCK_ARTICLE_2 = {
  id: "mock-article-2",
  title: "某会议在京召开",
  originalUrl: "https://example.com/article-2",
  sourceId: "mock-source-2",
  source: { id: "mock-source-2", name: "政府网", platform: "web" },
  fullText: "某某领导出席会议并讲话。",
  excerpt: "会议召开",
  contentType: "article",
  qualityStatus: "rejected",
  aiDecision: "reject",
  aiScore: 20,
  aiScoredAt: "2026-06-15T10:00:00Z",
  publishedAt: "2026-06-14T08:00:00Z",
  createdAt: "2026-06-14T09:00:00Z",
  wordCount: 50,
  effectiveTextLength: 40,
  topicTags: [],
  regionScopes: [],
  _count: { materialCards: 0 },
  userRead: false,
  userIgnored: false,
  userBookmarked: false,
};

const ARTICLES_LIST = [MOCK_ARTICLE, MOCK_ARTICLE_2];

// ─── Handlers ───

export const articlesHandlers = [
  // GET /api/articles
  http.get("/api/articles", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const keyword = url.searchParams.get("keyword") || url.searchParams.get("search") || "";
    const qualityStatus = url.searchParams.get("qualityStatus") || "";
    const filter = url.searchParams.get("filter") || "";

    let filtered = [...ARTICLES_LIST];

    if (keyword) {
      filtered = filtered.filter(
        (a) => a.title.includes(keyword) || a.fullText.includes(keyword)
      );
    }
    if (qualityStatus) {
      filtered = filtered.filter((a) => a.qualityStatus === qualityStatus);
    }
    if (filter === "favorites") {
      filtered = filtered.filter((a) => a.userBookmarked);
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

  // GET /api/content-items
  http.get("/api/content-items", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const start = (page - 1) * pageSize;
    const data = ARTICLES_LIST.slice(start, start + pageSize);

    return HttpResponse.json({
      data,
      total: ARTICLES_LIST.length,
      page,
      pageSize,
      totalPages: Math.ceil(ARTICLES_LIST.length / pageSize),
    });
  }),

  // GET /api/content-items/:id
  http.get("/api/content-items/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const article = ARTICLES_LIST.find((a) => a.id === params.id);
    if (!article) {
      return HttpResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    return HttpResponse.json({
      ...article,
      materialCards: [],
      annotations: [],
    });
  }),

  // POST /api/content-items/:id/score
  http.post("/api/content-items/:id/score", ({ params }) => {
    const article = ARTICLES_LIST.find((a) => a.id === params.id);
    if (!article) {
      return HttpResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    return HttpResponse.json({
      id: article.id,
      aiScore: 82,
      aiScoreDetail: { reasoning: "这是一篇有价值的基层治理案例" },
      aiScoredAt: new Date().toISOString(),
    });
  }),

  // GET /api/content-items/:id/score
  http.get("/api/content-items/:id/score", ({ params }) => {
    const article = ARTICLES_LIST.find((a) => a.id === params.id);
    if (!article) {
      return HttpResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    return HttpResponse.json({
      id: article.id,
      aiScore: article.aiScore,
      aiScoreDetail: { reasoning: "评分详情" },
      aiScoredAt: article.aiScoredAt,
    });
  }),

  // POST /api/content-items/:id/generate-card
  http.post("/api/content-items/:id/generate-card", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth || (auth.role !== "ADMIN" && auth.role !== "VERIFIED_USER")) {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const article = ARTICLES_LIST.find((a) => a.id === params.id);
    if (!article) {
      return HttpResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Simulate card already exists
    if (article._count.materialCards > 0 && !body.force) {
      return HttpResponse.json(
        {
          errorCode: "MATERIAL_CARD_ALREADY_EXISTS",
          error: "素材卡已存在",
          existingCardId: "mock-card-existing",
        },
        { status: 409 }
      );
    }

    return HttpResponse.json(
      {
        accepted: true,
        requestId: "mock-request-id",
        contentItemId: article.id,
        tasks: [
          {
            cardType: body.cardType || "golden_sentence",
            taskId: "mock-task-id",
          },
        ],
      },
      { status: 202 }
    );
  }),

  // GET /api/discover
  http.get("/api/discover", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const approvedArticles = ARTICLES_LIST.filter(
      (a) => a.qualityStatus === "approved"
    );

    return HttpResponse.json({
      data: approvedArticles,
      total: approvedArticles.length,
      page,
      pageSize,
      totalPages: Math.ceil(approvedArticles.length / pageSize),
    });
  }),

  // GET /api/explore
  http.get("/api/explore", ({ request }) => {
    const auth = getAuthUser();
    if (!auth) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    let filtered = ARTICLES_LIST.filter(
      (a) => a.qualityStatus === "approved" || a.aiDecision === "accept"
    );
    if (q) {
      filtered = filtered.filter(
        (a) => a.title.includes(q) || a.fullText.includes(q)
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

  // POST /api/content-items/assess
  http.post("/api/content-items/assess", async () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json(
      {
        accepted: true,
        taskId: "mock-assess-task-id",
        status: "PENDING",
        queuedCount: 2,
        message: "已提交评估任务",
      },
      { status: 202 }
    );
  }),

  // POST /api/admin/content-items/review
  http.post("/api/admin/content-items/review", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      reviewed: (body.ids as string[]).length,
      action: body.action,
    });
  }),
];
