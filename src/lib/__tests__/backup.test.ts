import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Mock the db module so backup functions don't hit a real database
vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    source: { findMany: vi.fn().mockResolvedValue([]) },
    aiConfig: { findMany: vi.fn().mockResolvedValue([]) },
    aiPromptTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    systemLog: { findMany: vi.fn().mockResolvedValue([]) },
    session: { findMany: vi.fn().mockResolvedValue([]) },
    collectionChannel: { findMany: vi.fn().mockResolvedValue([]) },
    contentItem: { findMany: vi.fn().mockResolvedValue([]) },
    collectorRun: { findMany: vi.fn().mockResolvedValue([]) },
    asyncTask: { findMany: vi.fn().mockResolvedValue([]) },
    materialCard: { findMany: vi.fn().mockResolvedValue([]) },
    syncRecord: { findMany: vi.fn().mockResolvedValue([]) },
    articleAnnotation: { findMany: vi.fn().mockResolvedValue([]) },
    // For restore
    articleAnnotation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    syncRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    materialCard: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    asyncTask: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    collectorRun: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contentItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    collectionChannel: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    systemLog: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    aiPromptTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    aiConfig: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    source: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
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
    expect(parsed.sourceDb).toBe("postgresql");
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
});
