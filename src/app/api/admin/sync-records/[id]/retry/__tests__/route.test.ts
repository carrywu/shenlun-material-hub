import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  syncRecordFindUnique: vi.fn(),
  cardFindUnique: vi.fn(),
  syncMaterialCard: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  unauthorizedResponse: () => Response.json({ error: "未登录" }, { status: 401 }),
  forbiddenResponse: (message = "无权访问") => Response.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    syncRecord: { findUnique: mocks.syncRecordFindUnique },
    materialCard: { findUnique: mocks.cardFindUnique },
  },
}));

vi.mock("@/services/ima-sync", () => ({
  ImaService: { syncMaterialCard: mocks.syncMaterialCard },
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: mocks.auditLog,
}));

import { POST } from "../route";

const ADMIN = { id: "admin-1", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };

function request(id: string, withCookie = true) {
  return new NextRequest(`http://localhost/api/admin/sync-records/${id}/retry`, {
    method: "POST",
    headers: withCookie ? { cookie: "auth_token=t" } : {},
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/sync-records/[id]/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
  });

  it("非 ADMIN（requireAdmin 返回 null，带 cookie）→ 403", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const res = await POST(request("rec-1", true), ctx("rec-1"));
    expect(res.status).toBe(403);
    expect(mocks.syncMaterialCard).not.toHaveBeenCalled();
  });

  it("未登录（无 cookie）→ 401", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const res = await POST(request("rec-1", false), ctx("rec-1"));
    expect(res.status).toBe(401);
  });

  it("记录不存在 → 404", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue(null);
    const res = await POST(request("nope"), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("文章正文同步记录（materialCardId 为空）→ 400", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue({
      id: "rec-art",
      materialCardId: null,
      documentRole: "original_archive",
    });
    const res = await POST(request("rec-art"), ctx("rec-art"));
    expect(res.status).toBe(400);
    expect(mocks.syncMaterialCard).not.toHaveBeenCalled();
  });

  it("ADMIN 代重同步他人卡：以卡真实 owner 调 service，记录归属原用户，写审计", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue({
      id: "rec-1",
      materialCardId: "card-b",
      documentRole: "material_card",
    });
    mocks.cardFindUnique.mockResolvedValue({ id: "card-b", ownerUserId: "user-b" });
    mocks.syncMaterialCard.mockResolvedValue({
      status: "success",
      syncRecordId: "sync-new",
      imaDocumentId: "doc-1",
    });

    const res = await POST(request("rec-1"), ctx("rec-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    // 以卡真实 owner（user-b）调 service，不是 ADMIN（admin-1）
    expect(mocks.syncMaterialCard).toHaveBeenCalledWith({
      materialCardId: "card-b",
      userId: "user-b",
    });
    // 审计标记运维代操作 + 原 owner
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "sync",
        resource: "MaterialCard",
        resourceId: "card-b",
        detail: expect.objectContaining({
          retriedByAdmin: "admin-1",
          originalOwner: "user-b",
        }),
      }),
    );
    expect(body.success).toBe(true);
  });

  it("ADMIN 代重同步自己卡：owner 即自己，正常工作", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue({
      id: "rec-mine",
      materialCardId: "card-admin",
      documentRole: "material_card",
    });
    mocks.cardFindUnique.mockResolvedValue({ id: "card-admin", ownerUserId: "admin-1" });
    mocks.syncMaterialCard.mockResolvedValue({ status: "success", syncRecordId: "sync-2" });

    const res = await POST(request("rec-mine"), ctx("rec-mine"));

    expect(res.status).toBe(200);
    expect(mocks.syncMaterialCard).toHaveBeenCalledWith({
      materialCardId: "card-admin",
      userId: "admin-1",
    });
  });

  it("卡不存在 → 404", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue({
      id: "rec-1",
      materialCardId: "card-gone",
      documentRole: "material_card",
    });
    mocks.cardFindUnique.mockResolvedValue(null);
    const res = await POST(request("rec-1"), ctx("rec-1"));
    expect(res.status).toBe(404);
    expect(mocks.syncMaterialCard).not.toHaveBeenCalled();
  });

  it("service 同步失败时返回失败结果但仍 200（结构化错误）", async () => {
    mocks.syncRecordFindUnique.mockResolvedValue({
      id: "rec-1",
      materialCardId: "card-b",
      documentRole: "material_card",
    });
    mocks.cardFindUnique.mockResolvedValue({ id: "card-b", ownerUserId: "user-b" });
    mocks.syncMaterialCard.mockResolvedValue({
      status: "failed",
      syncRecordId: "sync-fail",
      errorCode: "IMA_AUTH_FAILED",
      errorMessage: "IMA 鉴权失败",
    });

    const res = await POST(request("rec-1"), ctx("rec-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe("IMA_AUTH_FAILED");
  });
});
