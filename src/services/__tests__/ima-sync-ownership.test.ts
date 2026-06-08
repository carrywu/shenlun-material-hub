import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  syncRecordFindFirst: vi.fn(),
  syncRecordFindMany: vi.fn(),
  materialCardFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    syncRecord: {
      findFirst: dbMocks.syncRecordFindFirst,
      findMany: dbMocks.syncRecordFindMany,
    },
    materialCard: {
      findFirst: dbMocks.materialCardFindFirst,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((value: string) => value),
}));

const user = { id: "user-1", username: "user", role: "VERIFIED_USER" as const, status: "ACTIVE" as const };
const admin = { id: "admin-1", username: "admin", role: "ADMIN" as const, status: "ACTIVE" as const };

describe("ima-sync owner-scoped queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.syncRecordFindFirst.mockResolvedValue({ id: "sync-1", userId: "user-1" });
    dbMocks.materialCardFindFirst.mockResolvedValue({ id: "card-1" });
    dbMocks.syncRecordFindMany.mockResolvedValue([{ id: "sync-1", userId: "user-1" }]);
  });

  it("scopes getSyncStatus by sync record userId for non-admin users", async () => {
    const { getSyncStatus } = await import("../ima-sync");

    await getSyncStatus("sync-1", user);

    expect(dbMocks.syncRecordFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "sync-1",
        OR: [{ userId: "user-1" }, { userId: null }],
      },
    }));
  });

  it("does not add owner scope for admin sync status queries", async () => {
    const { getSyncStatus } = await import("../ima-sync");

    await getSyncStatus("sync-1", admin);

    expect(dbMocks.syncRecordFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sync-1" },
    }));
  });

  it("checks material card ownership before returning sync history", async () => {
    const { getSyncHistory } = await import("../ima-sync");

    await getSyncHistory("card-1", user, 10);

    expect(dbMocks.materialCardFindFirst).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        OR: [{ ownerUserId: "user-1" }, { ownerUserId: null }],
      },
      select: { id: true },
    });
    expect(dbMocks.syncRecordFindMany).toHaveBeenCalledWith({
      where: {
        materialCardId: "card-1",
        OR: [{ userId: "user-1" }, { userId: null }],
      },
      orderBy: { syncedAt: "desc" },
      take: 10,
    });
  });

  it("throws a controlled not-found error when card history target is not accessible", async () => {
    dbMocks.materialCardFindFirst.mockResolvedValueOnce(null);
    const { getSyncHistory } = await import("../ima-sync");

    await expect(getSyncHistory("card-other", user, 10)).rejects.toThrow("素材卡不存在");
    expect(dbMocks.syncRecordFindMany).not.toHaveBeenCalled();
  });
});
