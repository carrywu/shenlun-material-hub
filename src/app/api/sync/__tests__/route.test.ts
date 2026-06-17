import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  materialFindUnique: vi.fn(),
  materialFindMany: vi.fn(),
  syncMaterialCard: vi.fn(),
  batchSyncMaterialCards: vi.fn(),
  getSyncStatus: vi.fn(),
  getSyncHistory: vi.fn(),
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
  getSyncStatus: mocks.getSyncStatus,
  getSyncHistory: mocks.getSyncHistory,
  // 与 service 中真实实现保持一致的纯函数
  canAccessSyncRecord: (record: { userId: string | null }, userId: string, isAdmin: boolean) =>
    isAdmin || record.userId === userId,
  canAccessCardHistory: (card: { ownerUserId: string | null } | null, userId: string, isAdmin: boolean) =>
    isAdmin || (card !== null && card.ownerUserId === userId),
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: mocks.auditLog,
}));

import { POST, GET } from "../route";

const ADMIN = { id: "admin-1", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };
const VERIFIED_A = { id: "user-a", username: "a", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
const VERIFIED_B = { id: "user-b", username: "b", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };

function post(body: unknown) {
  return new NextRequest("http://localhost/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "auth_token=t" },
    body: JSON.stringify(body),
  });
}

function get(query: string) {
  return new NextRequest(`http://localhost/api/sync?${query}`, {
    method: "GET",
    headers: { cookie: "auth_token=t" },
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

  // P0-1: ADMIN 不得把他人素材卡同步到自己的 IMA（需求 2.3/5.2）
  it("ADMIN 同步他人卡片时拒绝（单卡）", async () => {
    mocks.materialFindUnique.mockResolvedValue({
      id: "card-other",
      confirmed: true,
      ownerUserId: "user-a", // 别人的卡
    });

    const res = await POST(post({ cardId: "card-other" }));

    expect(res.status).toBe(403);
    expect(mocks.syncMaterialCard).not.toHaveBeenCalled();
  });

  it("ADMIN 批量同步含他人卡片时拒绝", async () => {
    mocks.materialFindMany.mockResolvedValue([
      { id: "card-mine", confirmed: true, ownerUserId: "admin-1" },
      { id: "card-other", confirmed: true, ownerUserId: "user-a" },
    ]);

    const res = await POST(post({ cardIds: ["card-mine", "card-other"] }));

    expect(res.status).toBe(403);
    expect(mocks.batchSyncMaterialCards).not.toHaveBeenCalled();
  });

  it("VERIFIED_USER 只能同步自己的卡（单卡，他人卡拒绝）", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(VERIFIED_A);
    mocks.materialFindUnique.mockResolvedValue({
      id: "card-b",
      confirmed: true,
      ownerUserId: "user-b",
    });

    const res = await POST(post({ cardId: "card-b" }));

    expect(res.status).toBe(403);
    expect(mocks.syncMaterialCard).not.toHaveBeenCalled();
  });
});

describe("GET /api/sync (P0-2: SyncRecord owner 隔离)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("非 owner 查询他人 syncRecord 返回 404（隐藏存在）", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(VERIFIED_A);
    // service 返回的记录属于 user-b
    mocks.getSyncStatus.mockResolvedValue({
      id: "rec-1",
      userId: "user-b",
      materialCardId: "card-b",
    });

    const res = await GET(get("syncRecordId=rec-1"));

    expect(res.status).toBe(404);
  });

  it("owner 查询自己的 syncRecord 正常返回", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(VERIFIED_A);
    mocks.getSyncStatus.mockResolvedValue({
      id: "rec-1",
      userId: "user-a",
      materialCardId: "card-a",
    });

    const res = await GET(get("syncRecordId=rec-1"));

    expect(res.status).toBe(200);
  });

  it("ADMIN 查询任意 syncRecord 正常返回", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(ADMIN);
    mocks.getSyncStatus.mockResolvedValue({
      id: "rec-1",
      userId: "user-b",
      materialCardId: "card-b",
    });

    const res = await GET(get("syncRecordId=rec-1"));

    expect(res.status).toBe(200);
  });

  it("非 owner 查询他人卡片的同步历史返回空（隐藏存在）", async () => {
    mocks.requireVerifiedUser.mockResolvedValue(VERIFIED_A);
    mocks.getSyncHistory.mockResolvedValue([]);

    const res = await GET(get("cardId=card-b"));

    expect(res.status).toBe(200);
    // service 应被告知是 user-a 查 user-b 的卡 → 返回空
    expect(mocks.getSyncHistory).toHaveBeenCalledWith(
      "card-b",
      expect.any(Number),
      "user-a",
      false,
    );
  });
});
