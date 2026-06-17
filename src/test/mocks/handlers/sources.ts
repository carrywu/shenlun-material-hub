import { http, HttpResponse } from "msw";
import { getAuthUser } from "./auth";

/**
 * Sources API mock handlers.
 * Covers: /api/sources, /api/sources/:id, /api/sources/:id/channels,
 *         /api/sources/import, /api/sources/quality
 */

// ─── Shared fixtures ───

const MOCK_SOURCE = {
  id: "mock-source-1",
  name: "人民日报",
  externalId: "rmrb",
  platform: "web",
  contentType: "article",
  trustLevel: "AUTHORITATIVE",
  regionScopes: ["全国"],
  baseUrl: "http://www.people.com.cn",
  isEnabled: true,
  verificationStatus: "VERIFIED",
  provider: "manual",
  collectionMode: "web_scraper",
  keywords: [],
  collectionFrequency: "daily",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-06-15T10:00:00Z",
  _count: { contentItems: 50 },
};

const MOCK_SOURCE_2 = {
  id: "mock-source-2",
  name: "观潮的螃蟹",
  externalId: "mp-source-1",
  platform: "wechat_mp",
  contentType: "article",
  trustLevel: "RELIABLE",
  regionScopes: ["湖南"],
  baseUrl: "",
  isEnabled: true,
  verificationStatus: "VERIFIED",
  provider: "we-mp-rss",
  collectionMode: "rss",
  keywords: [],
  collectionFrequency: "realtime",
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-06-15T10:00:00Z",
  _count: { contentItems: 30 },
};

const SOURCES_LIST = [MOCK_SOURCE, MOCK_SOURCE_2];

// ─── Handlers ───

export const sourcesHandlers = [
  // GET /api/sources
  http.get("/api/sources", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const platform = url.searchParams.get("platform") || "";
    const search = url.searchParams.get("search") || "";

    let filtered = SOURCES_LIST;
    if (platform) filtered = filtered.filter((s) => s.platform === platform);
    if (search) filtered = filtered.filter((s) => s.name.includes(search));

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

  // POST /api/sources
  http.post("/api/sources", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const newSource = {
      id: `mock-source-${Date.now()}`,
      name: body.name || "新来源",
      externalId: body.externalId || "",
      platform: body.platform || "web",
      contentType: body.contentType || "article",
      trustLevel: body.trustLevel || "RELIABLE",
      regionScopes: body.regionScopes || [],
      baseUrl: body.baseUrl || "",
      isEnabled: true,
      verificationStatus: "PENDING",
      provider: "manual",
      collectionMode: body.collectionMode || "web_scraper",
      keywords: body.keywords || [],
      collectionFrequency: body.collectionFrequency || "daily",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { contentItems: 0 },
    };
    return HttpResponse.json(newSource, { status: 201 });
  }),

  // GET /api/sources/:id
  http.get("/api/sources/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const source = SOURCES_LIST.find((s) => s.id === params.id);
    if (!source) {
      return HttpResponse.json({ error: "来源不存在" }, { status: 404 });
    }
    return HttpResponse.json({ ...source, collectorRuns: [] });
  }),

  // PUT /api/sources/:id
  http.put("/api/sources/:id", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const source = SOURCES_LIST.find((s) => s.id === params.id);
    if (!source) {
      return HttpResponse.json({ error: "来源不存在" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...source,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // DELETE /api/sources/:id (soft-delete)
  http.delete("/api/sources/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true });
  }),

  // POST /api/sources/:id/verify
  http.post("/api/sources/:id/verify", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const source = SOURCES_LIST.find((s) => s.id === params.id);
    if (!source) {
      return HttpResponse.json({ error: "来源不存在" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...source,
      verificationStatus: body.verificationStatus || "VERIFIED",
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/sources/:id/channels
  http.get("/api/sources/:id/channels", ({ params }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json([
      {
        id: "mock-channel-1",
        name: "首页要闻",
        listUrl: "http://www.people.com.cn/",
        urlPattern: "/news/*",
        isEnabled: true,
      },
    ]);
  }),

  // POST /api/sources/:id/channels
  http.post("/api/sources/:id/channels", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: `mock-channel-${Date.now()}`,
        name: body.name || "新频道",
        listUrl: body.listUrl || "",
        urlPattern: body.urlPattern || "",
        isEnabled: true,
      },
      { status: 201 }
    );
  }),

  // POST /api/sources/import
  http.post("/api/sources/import", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json(
      { created: 1, skipped: 0, errors: [] },
      { status: 201 }
    );
  }),

  // POST /api/sources/quality
  http.post("/api/sources/quality", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ success: true, refreshed: 2 });
  }),
];
