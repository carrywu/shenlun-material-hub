import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  contentFindUnique: vi.fn(),
  syncArticle: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: mocks.requireVerifiedUser,
  unauthorizedResponse: () => Response.json({ error: "未登录" }, { status: 401 }),
  forbiddenResponse: (message = "无权访问") => Response.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { findUnique: mocks.contentFindUnique },
  },
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockReturnValue(true),
}));

vi.mock("@/services/ima-sync", () => ({
  ImaService: {
    syncArticle: mocks.syncArticle,
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: mocks.auditLog,
}));

import { POST } from "../route";

const USER = { id: "user-1", username: "u", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };

function request() {
  return new NextRequest("http://localhost/api/articles/article-1/sync-to-ima", {
    method: "POST",
    headers: { cookie: "auth_token=t" },
  });
}

function ctx(id = "article-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/articles/[id]/sync-to-ima", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVerifiedUser.mockResolvedValue(USER);
    mocks.contentFindUnique.mockResolvedValue({
      id: "article-1",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
    });
  });

  it("文章已有素材卡时返回素材卡同步结果", async () => {
    mocks.syncArticle.mockResolvedValue({
      success: true,
      sourceType: "material-card",
      imaDocumentId: "doc-card",
      syncedAt: "2026-06-14T00:00:00.000Z",
    });

    const res = await POST(request(), ctx());

    expect(res.status).toBe(200);
    expect(mocks.syncArticle).toHaveBeenCalledWith({ articleId: "article-1", userId: "user-1" });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      sourceType: "material-card",
      imaDocumentId: "doc-card",
    });
  });

  it("文章没有素材卡时返回文章正文同步提示", async () => {
    mocks.syncArticle.mockResolvedValue({
      success: true,
      sourceType: "article",
      imaDocumentId: "doc-article",
      message: "当前文章尚未生成素材卡，已同步文章内容",
    });

    const res = await POST(request(), ctx());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      sourceType: "article",
      message: "当前文章尚未生成素材卡，已同步文章内容",
    });
  });

  it("IMA 配置缺失时返回明确错误", async () => {
    mocks.syncArticle.mockResolvedValue({
      success: false,
      sourceType: "article",
      errorCode: "IMA_CONFIG_MISSING",
      errorMessage: "请先在设置中配置个人 IMA 知识库",
    });

    const res = await POST(request(), ctx());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      errorCode: "IMA_CONFIG_MISSING",
      errorMessage: "请先在设置中配置个人 IMA 知识库",
    });
  });
});
