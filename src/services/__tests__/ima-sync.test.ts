import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  imaFindFirst: vi.fn(),
  cardFindUnique: vi.fn(),
  syncFindFirst: vi.fn(),
  syncCreate: vi.fn(),
  syncUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    imaTarget: { findFirst: dbMocks.imaFindFirst },
    materialCard: { findUnique: dbMocks.cardFindUnique },
    syncRecord: {
      findFirst: dbMocks.syncFindFirst,
      create: dbMocks.syncCreate,
      update: dbMocks.syncUpdate,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: (value: string) => value,
}));

import { ImaService } from "../ima-sync";

const CARD = {
  id: "card-1",
  title: "测试素材卡",
  cardType: "case_material",
  contentItemId: "article-1",
  confirmed: true,
  userEditedContent: null,
  markdownContent: "素材卡正文",
  aiSummary: null,
  contentItem: {
    id: "article-1",
    title: "测试文章",
    topicTags: "[\"基层治理\"]",
    regionScopes: null,
  },
};

describe("ImaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    dbMocks.imaFindFirst.mockResolvedValue({
      id: "target-1",
      baseUrl: "https://ima.test",
      clientId: "client-1",
      encryptedApiKey: "token-1",
      knowledgeBaseId: "kb-1",
    });
    dbMocks.cardFindUnique.mockResolvedValue(CARD);
    dbMocks.syncFindFirst.mockResolvedValue(null);
    dbMocks.syncCreate.mockResolvedValue({ id: "sync-1" });
    dbMocks.syncUpdate.mockResolvedValue({ id: "sync-1" });
  });

  it("配置缺失时返回结构化失败结果", async () => {
    dbMocks.imaFindFirst.mockResolvedValue(null);

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("IMA_CONFIG_MISSING");
    expect(result.errorMessage).toContain("请先在设置中配置个人 IMA 知识库");
  });

  it("素材卡同步成功时（import_doc → add_knowledge）写入远程 note_id", async () => {
    // 官方两步流程：先建笔记拿 note_id，再关联知识库。两次 fetch，均返回 code:0。
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, msg: "success", data: { note_id: "note-1" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, msg: "success", data: {} }),
      } as Response);

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("success");
    expect(result.imaDocumentId).toBe("note-1");
    // 断言请求形状：用官方鉴权头 + 官方路径。
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls[0][0]).toContain("openapi/note/v1/import_doc");
    expect(calls[1][0]).toContain("openapi/wiki/v1/add_knowledge");
    const headers = calls[0][1]?.headers as Record<string, string>;
    expect(headers["ima-openapi-clientid"]).toBe("client-1");
    expect(headers["ima-openapi-apikey"]).toBe("token-1");
    expect(dbMocks.syncUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sync-1" },
      data: expect.objectContaining({ status: "success", remoteDocumentId: "note-1" }),
    }));
  });

  it("官方返回业务错误（code!==0）时透出 msg", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 200002, msg: "skill auth failed", data: {} }),
    } as Response);

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("IMA_AUTH_FAILED");
    expect(result.errorMessage).toContain("skill auth failed");
  });

  it("已成功同步过的素材卡再次同步时返回跳过结果", async () => {
    dbMocks.syncFindFirst.mockResolvedValue({
      id: "sync-existing",
      remoteDocumentId: "doc-existing",
      targetRemoteId: "kb-1",
    });

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("skipped");
    expect(result.imaDocumentId).toBe("doc-existing");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(dbMocks.syncCreate).not.toHaveBeenCalled();
  });

  it("IMA 返回 500 时记录结构化错误", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("server down"),
    } as Response);

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("IMA_API_ERROR");
    expect(result.errorMessage).toContain("server down");
    expect(dbMocks.syncUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed", errorCode: "IMA_API_ERROR" }),
    }));
  });

  it("批量同步返回成功、失败和跳过明细", async () => {
    // card-1 成功（两步 fetch）；card-2 未确认→failed（不发请求）；card-3 已存在→skipped。
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, msg: "success", data: { note_id: "note-1" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, msg: "success", data: {} }),
      } as Response);
    dbMocks.cardFindUnique
      .mockResolvedValueOnce(CARD)
      .mockResolvedValueOnce({ ...CARD, id: "card-2", confirmed: false })
      .mockResolvedValueOnce({ ...CARD, id: "card-3" });
    dbMocks.syncFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "sync-existing", remoteDocumentId: "doc-existing", targetRemoteId: "kb-1" });

    const result = await ImaService.batchSyncMaterialCards({
      materialCardIds: ["card-1", "card-2", "card-3"],
      userId: "user-1",
      concurrency: 1,
    });

    expect(result.total).toBe(3);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.items.map((item) => item.status)).toEqual(["success", "failed", "skipped"]);
  });
});
