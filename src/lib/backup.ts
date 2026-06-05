import { gunzipSync, gzipSync } from "zlib";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

export interface BackupManifest {
  version: 1;
  createdAt: string;
  database: {
    filename: string;
    contentBase64: string;
    bytes: number;
  };
  uploads: Array<{
    relativePath: string;
    contentBase64: string;
    bytes: number;
  }>;
}

function collectUploadFiles(rootDir: string, currentDir = rootDir): BackupManifest["uploads"] {
  if (!statSafe(rootDir)?.isDirectory()) {
    return [];
  }

  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: BackupManifest["uploads"] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectUploadFiles(rootDir, absolutePath));
      continue;
    }

    const content = readFileSync(absolutePath);
    files.push({
      relativePath: path.relative(rootDir, absolutePath),
      contentBase64: content.toString("base64"),
      bytes: content.byteLength,
    });
  }

  return files;
}

function statSafe(targetPath: string) {
  try {
    return statSync(targetPath);
  } catch {
    return null;
  }
}

export async function createBackupArchive({
  dbPath,
  uploadsDir,
}: {
  dbPath: string;
  uploadsDir: string;
}): Promise<Buffer> {
  const dbContent = readFileSync(dbPath);
  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    database: {
      filename: path.basename(dbPath),
      contentBase64: dbContent.toString("base64"),
      bytes: dbContent.byteLength,
    },
    uploads: collectUploadFiles(uploadsDir),
  };

  return gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"));
}

export async function parseBackupArchive(input: Buffer): Promise<BackupManifest> {
  const parsed = JSON.parse(gunzipSync(input).toString("utf8")) as BackupManifest;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported backup version: ${parsed.version}`);
  }
  return parsed;
}

export function summarizeBackupArchive(manifest: BackupManifest) {
  return {
    version: manifest.version,
    createdAt: manifest.createdAt,
    databaseBytes: manifest.database.bytes,
    uploadCount: manifest.uploads.length,
    uploadBytes: manifest.uploads.reduce((sum, file) => sum + file.bytes, 0),
  };
}

export function resolveDatabaseFilePath(databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db") {
  if (databaseUrl.startsWith("file:")) {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), databaseUrl.slice("file:".length));
  }
  throw new Error(`Unsupported DATABASE_URL for backup: ${databaseUrl}`);
}

export function resolveUploadsDirectoryPath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "public/uploads");
}

export async function inspectBackupDatabase(manifest: BackupManifest) {
  const tempPath = path.join(os.tmpdir(), `shenlun-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  writeFileSync(tempPath, Buffer.from(manifest.database.contentBase64, "base64"));

  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(tempPath, { readonly: true });
    const counts = {
      contentItems: Number((db.prepare("SELECT COUNT(*) as count FROM ContentItem").get() as { count: number }).count),
      sources: Number((db.prepare("SELECT COUNT(*) as count FROM Source").get() as { count: number }).count),
      materialCards: Number((db.prepare("SELECT COUNT(*) as count FROM MaterialCard").get() as { count: number }).count),
    };
    db.close();
    rmSync(tempPath, { force: true });
    return counts;
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export async function restoreBackupArchive(
  manifest: BackupManifest,
  {
    dbPath,
    uploadsDir,
  }: {
    dbPath: string;
    uploadsDir: string;
  }
) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });

  rmSync(uploadsDir, { recursive: true, force: true });
  mkdirSync(uploadsDir, { recursive: true });

  writeFileSync(dbPath, Buffer.from(manifest.database.contentBase64, "base64"));

  for (const file of manifest.uploads) {
    const absolutePath = path.join(uploadsDir, file.relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, Buffer.from(file.contentBase64, "base64"));
  }
}
