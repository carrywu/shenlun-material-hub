import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  materialFindUnique: vi.fn(),
  materialFindMany: vi.fn(),
  syncMaterialCard: vi.fn(),
  batchSyncMaterialCards: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: mocks.requireVerifiedUser,
  unauthorizedResponse: () => Response.json({ error: "未登录" }, { status: 401 }),
  forbiddenResponse: (message = "无权访问") => Response.json({ error: message }, { status: 403 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialCard: {
      findUnique: mocks.materialFindUnique,
      findMany: mocks.materialFindMany,
    },
  },
}));

vi.mock("@/services/ima-sync", () => ({
  ImaService: {
    syncMaterialCard: mocks.syncMaterialCard,
    batchSyncMaterialCards: mocks.batchSyncMaterialCards,
  },
  getSyncStatus: vi.fn(),
  getSyncHistory: vi.fn(),
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: mocks.auditLog,
}));

import { POST } from "../route";

const ADMIN = { id: "admin-1", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };

function post(body: unknown) {
  return new NextRequest("http://localhost/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "auth_token=t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN);
  });

  it("未选择素材卡时返回中文提示", async () => {
    const res = await POST(post({ cardIds: [] }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "请先选择要同步的素材卡" });
    expect(mocks.batchSyncMaterialCards).not.toHaveBeenCalled();
  });

  it("批量同步调用统一 IMA service 并返回明细", async () => {
    mocks.materialFindMany.mockResolvedValue([
      { id: "card-1", confirmed: true, ownerUserId: "admin-1" },
      { id: "card-2", confirmed: true, ownerUserId: "admin-1" },
    ]);
    mocks.batchSyncMaterialCards.mockResolvedValue({
      total: 2,
      success: 1,
      failed: 1,
      skipped: 0,
      items: [
        { materialCardId: "card-1", status: "success", imaDocumentId: "doc-1" },
        { materialCardId: "card-2", status: "failed", errorCode: "IMA_AUTH_FAILED", errorMessage: "IMA 鉴权失败" },
      ],
    });

    const res = await POST(post({ cardIds: ["card-1", "card-2"] }));

    expect(res.status).toBe(200);
    expect(mocks.batchSyncMaterialCards).toHaveBeenCalledWith({
      materialCardIds: ["card-1", "card-2"],
      userId: "admin-1",
    });
    const body = await res.json();
    expect(body.success).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.items[1]).toMatchObject({
      materialCardId: "card-2",
      status: "failed",
      errorMessage: "IMA 鉴权失败",
    });
  });
});
