import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  imaFindFirst: vi.fn(),
  cardFindUnique: vi.fn(),
  contentFindUnique: vi.fn(),
  syncFindFirst: vi.fn(),
  syncCreate: vi.fn(),
  syncUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    imaTarget: { findFirst: dbMocks.imaFindFirst },
    materialCard: { findUnique: dbMocks.cardFindUnique },
    contentItem: { findUnique: dbMocks.contentFindUnique },
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
  ownerUserId: "user-1",
  archivedAt: null,
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

  // Batch A / A5: service 层独立 owner 防线 —— 不能只靠 route 层。
  it("syncMaterialCard 拒绝非 owner 的卡（即使 confirmed），返回 FORBIDDEN 且不写远程", async () => {
    dbMocks.cardFindUnique.mockResolvedValue({ ...CARD, ownerUserId: "user-other" });

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("MATERIAL_CARD_FORBIDDEN");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(dbMocks.syncCreate).not.toHaveBeenCalled();
  });

  it("syncMaterialCard 拒绝已归档的卡（即使 owner 正确）", async () => {
    dbMocks.cardFindUnique.mockResolvedValue({ ...CARD, archivedAt: new Date("2026-06-01") });

    const result = await ImaService.syncMaterialCard({ materialCardId: "card-1", userId: "user-1" });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("MATERIAL_CARD_ARCHIVED");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(dbMocks.syncCreate).not.toHaveBeenCalled();
  });

  it("syncMaterialCard owner 正确、confirmed、未归档时正常同步", async () => {
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
  });
});

// Batch A / A4: syncArticle 不得把他人 confirmed 卡同步到调用者 IMA。
describe("ImaService.syncArticle — owner 隔离", () => {
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
    dbMocks.syncFindFirst.mockResolvedValue(null);
    dbMocks.syncCreate.mockResolvedValue({ id: "sync-art-1" });
    dbMocks.syncUpdate.mockResolvedValue({ id: "sync-art-1" });
    // syncArticle 无 confirmed 卡时走正文同步路径，需 config 可用 + fetch 成功。
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 0, msg: "success", data: { note_id: "note-art" } }),
    } as Response);
  });

  it("文章关联卡只同步当前用户自己的 confirmed 卡，他人卡与归档卡被排除", async () => {
    dbMocks.contentFindUnique.mockResolvedValue({
      id: "article-1",
      adminReviewStatus: "approved",
      fullText: "正文",
      materialCards: [
        { id: "own-card", ownerUserId: "user-1", archivedAt: null, confirmed: true },
        { id: "other-card", ownerUserId: "user-2", archivedAt: null, confirmed: true },
        { id: "own-archived", ownerUserId: "user-1", archivedAt: new Date("2026-06-01"), confirmed: true },
        { id: "own-unconfirmed", ownerUserId: "user-1", archivedAt: null, confirmed: false },
      ],
    });
    // syncMaterialCard 路径会再次 findUnique 每张卡。为让测试真正验证 syncArticle 的过滤
    // （而非依赖 mock 返回 null 把卡判为不存在），这里对所有卡都返回可同步对象。
    // 如果 syncArticle 没有按 owner/archived 过滤，other-card / own-archived 也会发起 import_doc。
    dbMocks.cardFindUnique.mockImplementation((args: { where: { id: string } }) => {
      const map: Record<string, object> = {
        "own-card": { ...CARD, id: "own-card", ownerUserId: "user-1", archivedAt: null },
        "other-card": { ...CARD, id: "other-card", ownerUserId: "user-2", archivedAt: null },
        "own-archived": { ...CARD, id: "own-archived", ownerUserId: "user-1", archivedAt: new Date("2026-06-01") },
      };
      return Promise.resolve(map[args.where.id] ?? null);
    });

    const result = await ImaService.syncArticle({ articleId: "article-1", userId: "user-1" });

    expect(result.sourceType).toBe("material-card");
    // 只对 own-card 发起远程写入（import_doc）。
    const importCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("import_doc"),
    );
    expect(importCalls).toHaveLength(1);
  });

  it("文章正文同步（无卡）路径不受影响", async () => {
    dbMocks.contentFindUnique.mockResolvedValue({
      id: "article-1",
      adminReviewStatus: "approved",
      fullText: "正文",
      materialCards: [],
    });

    const result = await ImaService.syncArticle({ articleId: "article-1", userId: "user-1" });

    expect(result.sourceType).toBe("article");
    expect(result.success).toBe(true);
  });
});
