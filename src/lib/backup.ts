import { gunzipSync, gzipSync } from "zlib";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import path from "path";
import { db } from "./db";

// ─── Manifest v2: Prisma serialization (PostgreSQL compatible) ─────────────

export interface BackupManifestV2 {
  version: 2;
  createdAt: string;
  sourceDb: "postgresql";
  tables: {
    [tableName: string]: {
      rows: Record<string, unknown>[];
      count: number;
    };
  };
  uploads: Array<{
    relativePath: string;
    contentBase64: string;
    bytes: number;
  }>;
}

// Legacy v1 manifest (SQLite file-based)
export interface BackupManifestV1 {
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

export type BackupManifest = BackupManifestV2 | BackupManifestV1;

// Migration order for restore (respect FK dependencies)
const TABLE_ORDER = [
  "User",
  "Source",
  "AiConfig",
  "AiPromptTemplate",
  "SystemLog",
  "Session",
  "CollectionChannel",
  "ContentItem",
  "CollectorRun",
  "AsyncTask",
  "MaterialCard",
  "SyncRecord",
  "ArticleAnnotation",
] as const;

// Reverse order for truncate (reverse FK dependencies)
const TABLE_ORDER_REVERSE = [...TABLE_ORDER].reverse();

function toModelName(tableName: string): string {
  return tableName.charAt(0).toLowerCase() + tableName.slice(1);
}

// ─── Upload file collection ─────────────────────────────────────────────────

function collectUploadFiles(rootDir: string, currentDir = rootDir): BackupManifestV2["uploads"] {
  if (!statSafe(rootDir)?.isDirectory()) {
    return [];
  }

  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: BackupManifestV2["uploads"] = [];

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

// ─── Export: serialize all tables via Prisma ─────────────────────────────────

export async function createBackupArchive({
  uploadsDir,
}: {
  uploadsDir: string;
}): Promise<Buffer> {
  const tables: BackupManifestV2["tables"] = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = db as any;

  for (const table of TABLE_ORDER) {
    const model = p[toModelName(table)];
    if (!model) continue;

    const rows = await model.findMany();
    tables[table] = { rows, count: rows.length };
  }

  const manifest: BackupManifestV2 = {
    version: 2,
    createdAt: new Date().toISOString(),
    sourceDb: "postgresql",
    tables,
    uploads: collectUploadFiles(uploadsDir),
  };

  return gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"));
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export async function parseBackupArchive(input: Buffer): Promise<BackupManifest> {
  const raw = JSON.parse(gunzipSync(input).toString("utf8")) as { version: number };
  const version = raw.version;

  if (version === 1) {
    throw new Error(
      "此备份为 SQLite (v1) 格式，无法恢复到 PostgreSQL 数据库。" +
        "请使用 PostgreSQL (v2) 格式的备份文件。"
    );
  }

  if (version !== 2) {
    throw new Error(`不支持的备份版本: ${version}`);
  }

  return gunzipSync(input).toString("utf8").length > 0
    ? (JSON.parse(gunzipSync(input).toString("utf8")) as BackupManifestV2)
    : ({} as BackupManifestV2);
}

// ─── Summarize ───────────────────────────────────────────────────────────────

export function summarizeBackupArchive(manifest: BackupManifest) {
  if (manifest.version === 2) {
    const v2 = manifest as BackupManifestV2;
    const tableSummary: Record<string, number> = {};
    for (const [name, data] of Object.entries(v2.tables)) {
      tableSummary[name] = data.count;
    }
    return {
      version: v2.version,
      createdAt: v2.createdAt,
      sourceDb: v2.sourceDb,
      tableSummary,
      totalRows: Object.values(v2.tables).reduce((sum, t) => sum + t.count, 0),
      uploadCount: v2.uploads.length,
      uploadBytes: v2.uploads.reduce((sum, f) => sum + f.bytes, 0),
    };
  }

  // v1 fallback
  const v1 = manifest as BackupManifestV1;
  return {
    version: v1.version,
    createdAt: v1.createdAt,
    databaseBytes: v1.database.bytes,
    uploadCount: v1.uploads.length,
    uploadBytes: v1.uploads.reduce((sum, f) => sum + f.bytes, 0),
  };
}

// ─── Inspect: count rows from serialized data ───────────────────────────────

export async function inspectBackupDatabase(manifest: BackupManifest) {
  if (manifest.version === 2) {
    const v2 = manifest as BackupManifestV2;
    return {
      contentItems: v2.tables.ContentItem?.count ?? 0,
      sources: v2.tables.Source?.count ?? 0,
      materialCards: v2.tables.MaterialCard?.count ?? 0,
    };
  }

  throw new Error("v1 备份无法在 PostgreSQL 环境中检查。");
}

// ─── Restore: write tables via Prisma ────────────────────────────────────────

export async function restoreBackupArchive(
  manifest: BackupManifest,
  {
    uploadsDir,
  }: {
    uploadsDir: string;
  }
) {
  if (manifest.version !== 2) {
    throw new Error("只支持 v2 (PostgreSQL) 格式的备份恢复。");
  }

  const v2 = manifest as BackupManifestV2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = db as any;

  // Truncate all tables in reverse FK order
  for (const table of TABLE_ORDER_REVERSE) {
    const model = p[toModelName(table)];
    if (model) {
      await model.deleteMany({});
    }
  }

  // Insert data in FK order
  for (const table of TABLE_ORDER) {
    const tableData = v2.tables[table];
    if (!tableData || tableData.count === 0) continue;

    const model = p[toModelName(table)];
    if (!model) continue;

    // Batch insert (100 rows at a time)
    const BATCH_SIZE = 100;
    for (let i = 0; i < tableData.rows.length; i += BATCH_SIZE) {
      const batch = tableData.rows.slice(i, i + BATCH_SIZE);
      await model.createMany({ data: batch });
    }
  }

  // Restore upload files
  mkdirSync(uploadsDir, { recursive: true });
  rmSync(uploadsDir, { recursive: true, force: true });
  mkdirSync(uploadsDir, { recursive: true });

  for (const file of v2.uploads) {
    const absolutePath = path.join(uploadsDir, file.relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, Buffer.from(file.contentBase64, "base64"));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveUploadsDirectoryPath() {
  return path.resolve(process.cwd(), "public/uploads");
}
