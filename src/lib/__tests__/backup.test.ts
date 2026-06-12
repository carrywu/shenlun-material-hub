import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Mock the db module so backup functions don't hit a real database
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    source: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    aiConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    aiPromptTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    systemLog: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    collectionChannel: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contentItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    collectorRun: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    asyncTask: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    materialCard: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    syncRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    articleAnnotation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ count: BigInt(0) }]),
  },
}));

describe("backup helpers", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "shenlun-backup-"));
  });

  it("creates and parses a gzip backup archive (v2)", async () => {
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });
    writeFileSync(path.join(uploadsDir, "a.txt"), "hello");

    const { createBackupArchive, parseBackupArchive } = await import("../backup");

    const archive = await createBackupArchive({ uploadsDir });
    const parsed = await parseBackupArchive(archive);

    expect(parsed.version).toBe(2);
    if (parsed.version === 2) {
      expect(parsed.sourceDb).toBe("postgresql");
    }
    expect(parsed.uploads).toHaveLength(1);
    expect(parsed.uploads[0]?.relativePath).toBe("a.txt");
  });

  it("restores upload files to target directory", async () => {
    const sourceUploadsDir = path.join(rootDir, "source-uploads");
    const targetUploadsDir = path.join(rootDir, "target-uploads");
    mkdirSync(sourceUploadsDir, { recursive: true });
    mkdirSync(targetUploadsDir, { recursive: true });
    mkdirSync(path.join(sourceUploadsDir, "nested"), { recursive: true });
    writeFileSync(path.join(sourceUploadsDir, "nested/file.txt"), "nested-data", { flag: "w" });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");

    const archive = await createBackupArchive({ uploadsDir: sourceUploadsDir });
    const parsed = await parseBackupArchive(archive);
    await restoreBackupArchive(parsed, { uploadsDir: targetUploadsDir });

    expect(readFileSync(path.join(targetUploadsDir, "nested/file.txt"), "utf8")).toBe("nested-data");
  });

  it("returns RBAC warnings when no active admin exists", async () => {
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");
    const { db } = await import("@/lib/db");

    // Mock: 0 admins (first call), 0 total users (second call), 0 sessions
    vi.mocked(db.user.count).mockResolvedValue(0);
    vi.mocked(db.session.count).mockResolvedValue(0);

    const archive = await createBackupArchive({ uploadsDir });
    const parsed = await parseBackupArchive(archive);
    const result = await restoreBackupArchive(parsed, { uploadsDir });

    expect(result.rbacWarnings).toContain("恢复后无活跃管理员账户，请手动创建管理员");
  });

  it("returns RBAC warnings when sessions exist but no users", async () => {
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");
    const { db } = await import("@/lib/db");

    // Mock: admin exists, but 0 users and 5 sessions
    vi.mocked(db.user.count)
      .mockResolvedValueOnce(1)  // admin check: at least one admin
      .mockResolvedValueOnce(0); // total users: 0
    vi.mocked(db.session.count).mockResolvedValue(5);

    const archive = await createBackupArchive({ uploadsDir });
    const parsed = await parseBackupArchive(archive);
    const result = await restoreBackupArchive(parsed, { uploadsDir });

    expect(result.rbacWarnings).toContain("恢复后有 5 个会话但无用户，建议清理孤立会话");
  });

  it("returns RBAC warnings when orphaned sessions reference non-existent users", async () => {
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");
    const { db } = await import("@/lib/db");

    // Mock: admin exists, 3 users, 10 sessions, 2 orphaned
    vi.mocked(db.user.count)
      .mockResolvedValueOnce(1)  // admin check: has admin
      .mockResolvedValueOnce(3); // total users: 3
    vi.mocked(db.session.count).mockResolvedValue(10);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: BigInt(2) }]);

    const archive = await createBackupArchive({ uploadsDir });
    const parsed = await parseBackupArchive(archive);
    const result = await restoreBackupArchive(parsed, { uploadsDir });

    expect(result.rbacWarnings).toContain("恢复后有 2 个孤立会话（引用了不存在的用户），建议清理");
  });

  it("returns no warnings when data is healthy", async () => {
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");
    const { db } = await import("@/lib/db");

    // Mock: admin exists, users exist, sessions exist, no orphans
    vi.mocked(db.user.count)
      .mockResolvedValueOnce(1)  // admin check: has admin
      .mockResolvedValueOnce(2); // total users: 2
    vi.mocked(db.session.count).mockResolvedValue(5);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);

    const archive = await createBackupArchive({ uploadsDir });
    const parsed = await parseBackupArchive(archive);
    const result = await restoreBackupArchive(parsed, { uploadsDir });

    expect(result.rbacWarnings).toEqual([]);
  });
});
