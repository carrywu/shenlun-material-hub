import { http, HttpResponse } from "msw";
import { getAuthUser } from "./auth";

/**
 * Async Task API mock handlers.
 * Covers: /api/admin/tasks, /api/health
 */

// ─── Shared fixtures ───

const MOCK_TASK = {
  id: "mock-task-id",
  type: "AI_ARTICLE_ASSESSMENT",
  status: "COMPLETED",
  userId: "mock-admin-id",
  contentItemId: "mock-article-1",
  startedAt: "2026-06-15T10:00:00Z",
  finishedAt: "2026-06-15T10:00:05Z",
  result: { decision: "accept", score: 85 },
  errorSummary: null,
  createdAt: "2026-06-15T09:59:55Z",
};

const MOCK_PENDING_TASK = {
  id: "mock-pending-task-id",
  type: "MATERIAL_CARD_GENERATION",
  status: "PENDING",
  userId: "mock-admin-id",
  contentItemId: "mock-article-1",
  startedAt: null,
  finishedAt: null,
  result: null,
  errorSummary: null,
  createdAt: "2026-06-15T11:00:00Z",
};

const MOCK_FAILED_TASK = {
  id: "mock-failed-task-id",
  type: "AI_ARTICLE_ASSESSMENT",
  status: "FAILED",
  userId: "mock-admin-id",
  contentItemId: "mock-article-2",
  startedAt: "2026-06-15T12:00:00Z",
  finishedAt: "2026-06-15T12:00:02Z",
  result: null,
  errorSummary: "AI API call failed: Connection timeout",
  createdAt: "2026-06-15T11:59:55Z",
};

const TASKS_LIST = [MOCK_TASK, MOCK_PENDING_TASK, MOCK_FAILED_TASK];

// ─── Handlers ───

export const tasksHandlers = [
  // GET /api/admin/tasks
  http.get("/api/admin/tasks", ({ request }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    let filtered = TASKS_LIST;
    if (status) filtered = filtered.filter((t) => t.status === status);

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

  // GET /api/admin/tasks/:id
  http.get("/api/admin/tasks/:id", ({ params }) => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const task = TASKS_LIST.find((t) => t.id === params.id);
    if (!task) {
      return HttpResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  // GET /api/health
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),

  // POST /api/health/detail
  http.post("/api/health/detail", () => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "ADMIN") {
      return HttpResponse.json({ error: "权限不足" }, { status: 403 });
    }
    return HttpResponse.json({
      status: "ok",
      checks: {
        database: "connected",
        aiConfig: "configured",
        adminUser: "exists",
      },
      time: new Date().toISOString(),
      version: "0.1.0",
    });
  }),
];
