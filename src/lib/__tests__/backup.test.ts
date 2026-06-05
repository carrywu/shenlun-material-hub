import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("backup helpers", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "shenlun-backup-"));
  });

  it("creates and parses a gzip backup archive", async () => {
    const dbPath = path.join(rootDir, "dev.db");
    const uploadsDir = path.join(rootDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });
    writeFileSync(dbPath, "db-content");
    writeFileSync(path.join(uploadsDir, "a.txt"), "hello");

    const { createBackupArchive, parseBackupArchive } = await import("../backup");

    const archive = await createBackupArchive({ dbPath, uploadsDir });
    const parsed = await parseBackupArchive(archive);

    expect(parsed.version).toBe(1);
    expect(Buffer.from(parsed.database.contentBase64, "base64").toString("utf8")).toBe("db-content");
    expect(parsed.uploads).toHaveLength(1);
    expect(parsed.uploads[0]?.relativePath).toBe("a.txt");
  });

  it("restores backup contents to target paths", async () => {
    const sourceDbPath = path.join(rootDir, "source.db");
    const sourceUploadsDir = path.join(rootDir, "source-uploads");
    const targetDbPath = path.join(rootDir, "target.db");
    const targetUploadsDir = path.join(rootDir, "target-uploads");
    mkdirSync(sourceUploadsDir, { recursive: true });
    mkdirSync(targetUploadsDir, { recursive: true });
    mkdirSync(path.join(sourceUploadsDir, "nested"), { recursive: true });
    writeFileSync(sourceDbPath, "source-db");
    writeFileSync(path.join(sourceUploadsDir, "nested/file.txt"), "nested-data", { flag: "w" });

    const { createBackupArchive, parseBackupArchive, restoreBackupArchive } = await import("../backup");

    const archive = await createBackupArchive({ dbPath: sourceDbPath, uploadsDir: sourceUploadsDir });
    const parsed = await parseBackupArchive(archive);
    await restoreBackupArchive(parsed, { dbPath: targetDbPath, uploadsDir: targetUploadsDir });

    expect(readFileSync(targetDbPath, "utf8")).toBe("source-db");
    expect(readFileSync(path.join(targetUploadsDir, "nested/file.txt"), "utf8")).toBe("nested-data");
  });
});
