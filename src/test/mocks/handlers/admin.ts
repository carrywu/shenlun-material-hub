import { http, HttpResponse } from "msw";
import { getAuthUser } from "./auth";

/**
 * Admin API mock handlers.
 * Covers: /api/admin/users, /api/admin/invitations, /api/admin/metrics,
 *         /api/admin/logs, /api/admin/clean, /api/admin/backup, /api/admin/role-quotas
 */

// ─── Shared fixtures ───

const MOCK_USER_ITEM = {
  id: "mock-admin-id",
  username: "admin",
  email: "admin@example.com",
  displayName: "管理员",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-06-15T10:00:00Z",
  sessionCount: 5,
};

const MOCK_USER_ITEM_2 = {
  id: "mock-user-id",
  username: "user",
  email: "user@example.com",
  displayName: "普通用户",
  role: "USER",
  status: "ACTIVE",
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-06-15T10:00:00Z",
  sessionCount: 2,
};

const USERS_LIST = [MOCK_USER_ITEM, MOCK_USER_ITEM_2];

const MOCK_INVITATION = {
  id: "mock-invitation-id",
  code: "VALID-CODE",
  status: "ACTIVE",
  isEnabled: true,
  createdBy: "mock-admin-id",
  creator: { username: "admin" },
  maxUses: 10,
  usedCount: 3,
  remainingUses: 7,
  expiresAt: "2026-12-31T23:59:59Z",
  isDisabled: false,
  isExpired: false,
  isExhausted: false,
  createdAt: "2026-06-01T00:00:00Z",
  uses: [],
};

const ROLE_QUOTAS = [
  { id: "rq-1", role: "USER", favoriteLimit: 10 },
  { id: "rq-2", role: "VERIFIED_USER", favoriteLimit: 50 },
  { id: "rq-3", role: "ADMIN", favoriteLimit: 200 },
];

// ─── Handlers ───

export const adminHandlers = [
  // GET /api/admin/users
  http.get("/api/admin/users", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ items: USERS_LIST });
  }),

  // POST /api/admin/users
  http.post("/api/admin/users", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, string>;
    const newUser = {
      id: `mock-${body.username}-id`,
      username: body.username,
      email: body.email || "",
      displayName: body.displayName || body.username,
      role: body.role || "USER",
      status: "ACTIVE" as const,
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json({ user: newUser }, { status: 201 });
  }),

  // GET /api/admin/users/:id
  http.get("/api/admin/users/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const user = USERS_LIST.find((u) => u.id === params.id);
    if (!user) {
      return HttpResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    return HttpResponse.json({ user: { ...user, sessions: [] } });
  }),

  // PUT /api/admin/users/:id
  http.put("/api/admin/users/:id", async ({ params, request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const user = USERS_LIST.find((u) => u.id === params.id);
    if (!user) {
      return HttpResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    return HttpResponse.json({
      user: { ...user, ...body, updatedAt: new Date().toISOString() },
    });
  }),

  // DELETE /api/admin/users/:id — not supported
  http.delete("/api/admin/users/:id", () => {
    return HttpResponse.json(
      { error: "当前不支持删除用户，请使用禁用功能" },
      { status: 405 }
    );
  }),

  // GET /api/admin/invitations
  http.get("/api/admin/invitations", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ items: [MOCK_INVITATION] });
  }),

  // POST /api/admin/invitations
  http.post("/api/admin/invitations", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json(
      {
        invitation: {
          id: "mock-new-invitation-id",
          code: "NEW-CODE-123",
          status: "ACTIVE",
          isEnabled: true,
          createdBy: "mock-admin-id",
          creator: { username: "admin" },
          maxUses: 10,
          usedCount: 0,
          remainingUses: 10,
          expiresAt: "2026-12-31T23:59:59Z",
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }),

  // PATCH /api/admin/invitations/:id
  http.patch("/api/admin/invitations/:id", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      invitation: {
        ...MOCK_INVITATION,
        status: "DISABLED",
        isEnabled: false,
      },
    });
  }),

  // GET /api/admin/metrics
  http.get("/api/admin/metrics", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      dbStats: {
        totalArticles: 256,
        totalSources: 15,
        activeTasks: 3,
        failedTasks24h: 1,
        errorLogs24h: 5,
        dbSizeMb: 42.5,
      },
      systemStats: {
        memory: { used: 60, total: 256, percentage: 23.4 },
        cpu: { percentage: 15.2 },
        disk: { used: 12.3, total: 100, percentage: 12.3 },
        os: "darwin",
      },
      recentErrors: [
        {
          id: "err-1",
          level: "ERROR",
          category: "AI",
          message: "AI API timeout",
          createdAt: "2026-06-15T12:00:00Z",
        },
      ],
      recentTasks: [
        {
          id: "task-1",
          type: "AI_ARTICLE_ASSESSMENT",
          status: "COMPLETED",
          createdAt: "2026-06-15T10:00:00Z",
        },
      ],
    });
  }),

  // GET /api/admin/logs
  http.get("/api/admin/logs", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const stats = url.searchParams.get("stats") === "true";

    if (stats) {
      return HttpResponse.json({ errorCount: 5, warnCount: 12 });
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    return HttpResponse.json({
      data: [
        {
          id: "log-1",
          level: "ERROR",
          category: "AI",
          message: "AI API timeout",
          details: null,
          createdAt: "2026-06-15T12:00:00Z",
        },
        {
          id: "log-2",
          level: "WARN",
          category: "SYNC",
          message: "同步跳过重复文章",
          details: null,
          createdAt: "2026-06-15T11:00:00Z",
        },
      ],
      total: 2,
      page,
      pageSize,
      totalPages: 1,
    });
  }),

  // DELETE /api/admin/logs
  http.delete("/api/admin/logs", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const olderThanDays = parseInt(url.searchParams.get("olderThanDays") || "30");
    return HttpResponse.json({ success: true, deleted: olderThanDays * 2 });
  }),

  // GET /api/admin/clean (preview)
  http.get("/api/admin/clean", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      preview: {
        delete_old_filtered: 5,
        merge_duplicates: 2,
        fix_urls: 1,
        orphan_cards: 0,
      },
    });
  }),

  // POST /api/admin/clean (execute)
  http.post("/api/admin/clean", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      results: {
        delete_old_filtered: 5,
        merge_duplicates: 2,
        fix_urls: 1,
        orphan_cards: 0,
      },
      totalAffected: 8,
      logs: ["已删除5条过期过滤文章", "已合并2组重复文章", "已修复1条URL"],
    });
  }),

  // GET /api/admin/role-quotas
  http.get("/api/admin/role-quotas", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({ data: ROLE_QUOTAS });
  }),

  // PUT /api/admin/role-quotas
  http.put("/api/admin/role-quotas", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const quota = ROLE_QUOTAS.find((q) => q.role === body.role);
    return HttpResponse.json({
      success: true,
      data: { ...quota, favoriteLimit: body.favoriteLimit || 50 },
    });
  }),

  // GET /api/admin/backup/export
  http.get("/api/admin/backup/export", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    // Return a minimal gzip-like response
    return new HttpResponse(new ArrayBuffer(8), {
      headers: { "Content-Type": "application/gzip" },
    });
  }),

  // POST /api/admin/backup/import
  http.post("/api/admin/backup/import", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    // Simulate dry-run
    return HttpResponse.json({
      success: true,
      preview: { articles: 10, sources: 5, cards: 20 },
      dryRun: true,
    });
  }),

  // POST /api/admin/content-items/feature
  http.post("/api/admin/content-items/feature", async ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json({ success: true, id: body.id });
  }),

  // DELETE /api/admin/content-items/feature
  http.delete("/api/admin/content-items/feature", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    return HttpResponse.json({ success: true, id });
  }),
];
