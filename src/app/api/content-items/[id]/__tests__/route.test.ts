import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = { id: "admin-id", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const VERIFIED = { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.getUserFromRequest,
  requireAdmin: authMocks.getUserFromRequest,
  authErrorResponse: () => Response.json({ error: "unauth" }, { status: 401 }),
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockReturnValue(true),
  canModifyResource: vi.fn().mockReturnValue(true),
}));

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { findUnique: mocks.findUnique, update: mocks.update, delete: mocks.delete },
    userContentState: { findUnique: vi.fn().mockResolvedValue(null) },
    articleFavorite: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { GET } from "../route";

function makeReq(id: string, cookie: string | null) {
  const init: RequestInit = { method: "GET" };
  if (cookie) init.headers = { cookie };
  // NextRequest expects its own RequestInit where signal cannot be null
  const { signal, ...nextInit } = init;
  void signal;
  return [
    new NextRequest(`http://localhost/api/content-items/${id}`, nextInit),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/content-items/[id] — adminReviewStatus (P3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER 访问 pending_admin 文章 → 404（防 ID 绕过）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("VERIFIED_USER 访问 approved 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "approved",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("ADMIN 访问 pending_admin 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x", ownerUserId: null, visibility: "public", adminReviewStatus: "pending_admin",
      materialCards: [], annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  // ── P0-001: 子资源隔离（A 看不到 B 的卡/批注）──────────────────────────
  it("非 ADMIN 详情只返回自己的 materialCards（不含别人的）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    // DB 返回文章 + 混合卡（自己的 + 别人的 + legacy null）
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "v", cardType: "golden_sentence" },
        { id: "other", ownerUserId: "user-b", cardType: "golden_sentence" },
        { id: "legacy", ownerUserId: null, cardType: "golden_sentence" },
      ],
      annotations: [
        { id: "own-ann", userId: "v" },
        { id: "other-ann", userId: "user-b" },
      ],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    // 只有自己的卡；别人的和 legacy null 被过滤
    const cardIds = body.materialCards.map((c: { id: string }) => c.id);
    expect(cardIds).toEqual(["own"]);
    // 只有自己的批注
    const annIds = body.annotations.map((a: { id: string }) => a.id);
    expect(annIds).toEqual(["own-ann"]);
  });

  it("ADMIN 详情返回全部 materialCards 和 annotations", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "admin-id" },
        { id: "other", ownerUserId: "user-b" },
        { id: "legacy", ownerUserId: null },
      ],
      annotations: [{ id: "a1", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards.length).toBe(3);
    expect(body.annotations.length).toBe(1);
  });

  it("非 ADMIN 详情无自己的卡时 materialCards 为空数组", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [{ id: "other", ownerUserId: "user-b" }],
      annotations: [{ id: "other-ann", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards).toEqual([]);
    expect(body.annotations).toEqual([]);
  });
});
