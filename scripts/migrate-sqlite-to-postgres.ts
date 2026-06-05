/**
 * 一次性数据迁移脚本：SQLite → PostgreSQL
 *
 * 前提条件：
 *   1. PostgreSQL 已运行且 schema 已应用（Phase 1-3 完成）
 *   2. SQLite 文件存在于 SQLITE_SOURCE_PATH 指定路径
 *   3. DATABASE_URL 指向目标 PostgreSQL 实例
 *
 * 用法：
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts              # dry-run（仅计数）
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts --execute     # 实际执行
 *
 * 迁移顺序遵循外键依赖：
 *   无依赖 → User, Source, AiConfig, AiPromptTemplate, SystemLog
 *   Level 1 → Session, CollectionChannel, ContentItem, CollectorRun, AsyncTask
 *   Level 2 → MaterialCard
 *   Level 3 → SyncRecord, ArticleAnnotation
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─── 配置 ────────────────────────────────────────────────────────────────────

const SQLITE_PATH = process.env.SQLITE_SOURCE_PATH || "./prisma/dev.db";
const IS_EXECUTE = process.argv.includes("--execute");
const BATCH_SIZE = 100;

// 按 FK 依赖排序的表列表
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

// SQLite 中 Boolean 字段（存储为 0/1，需转为 true/false）
const BOOLEAN_FIELDS: Record<string, Set<string>> = {
  Source: new Set(["isEnabled"]),
  CollectionChannel: new Set(["isEnabled"]),
  ContentItem: new Set(["fullTextStored", "bookmarked", "read", "ignored"]),
  MaterialCard: new Set(["confirmed"]),
  AiConfig: new Set(["isEnabled"]),
  AiPromptTemplate: new Set(["enabled"]),
};

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function log(msg: string) {
  const prefix = IS_EXECUTE ? "[EXECUTE]" : "[DRY-RUN]";
  console.log(`${prefix} ${msg}`);
}

function toModelName(tableName: string): string {
  return tableName.charAt(0).toLowerCase() + tableName.slice(1);
}

/** 转换单行数据：SQLite → PostgreSQL 类型兼容 */
function convertRow(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
  const boolFields = BOOLEAN_FIELDS[tableName];
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;

    // Boolean 字段：0/1 → false/true
    if (boolFields?.has(key)) {
      cleaned[key] = value === 1 || value === true;
    }
    // DateTime 字段：SQLite 存为 ISO string，Prisma PostgreSQL 可直接接受
    // 其他字段原样传递
    else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  SQLite → PostgreSQL 数据迁移");
  console.log(`  模式: ${IS_EXECUTE ? "✅ EXECUTE（实际执行）" : "🔍 DRY-RUN（仅预览）"}`);
  console.log(`  SQLite 源: ${SQLITE_PATH}`);
  console.log(`  PostgreSQL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@") ?? "(未设置)"}`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");

  // 打开 SQLite（只读）
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // 连接 PostgreSQL
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  try {
    // Step 1: 获取每张表的行数
    log("📊 统计 SQLite 各表行数...\n");

    const sqliteCounts: Record<string, number> = {};
    const pgCounts: Record<string, number> = {};

    for (const table of TABLE_ORDER) {
      const row = sqlite.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).get() as { cnt: number };
      sqliteCounts[table] = row.cnt;

      const pgCount = await p[toModelName(table)]?.count();
      pgCounts[table] = pgCount ?? 0;
    }

    // 打印对照表
    console.log("  表名                    SQLite    PG(现有)   状态");
    console.log("  " + "─".repeat(55));
    let totalSqlite = 0;
    for (const table of TABLE_ORDER) {
      const sc = sqliteCounts[table];
      const pc = pgCounts[table];
      totalSqlite += sc;
      const status = pc > 0 ? `⚠️  已有 ${pc} 行` : "✅ 空";
      console.log(`  ${table.padEnd(24)}${String(sc).padStart(6)}${String(pc).padStart(10)}   ${status}`);
    }
    console.log("  " + "─".repeat(55));
    console.log(`  ${"总计".padEnd(24)}${String(totalSqlite).padStart(6)}`);
    console.log("");

    // 安全检查
    const totalPg = Object.values(pgCounts).reduce((a, b) => a + b, 0);
    if (totalPg > 0 && IS_EXECUTE) {
      console.error("❌ PostgreSQL 目标数据库不为空！请先清空或使用空数据库。");
      console.error("   如需重置：docker compose exec postgres psql -U shenlun -d shenlun_material_hub -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'");
      process.exit(1);
    }

    if (!IS_EXECUTE) {
      log("这是 DRY-RUN 模式 — 不执行任何写入。使用 --execute 参数实际执行。");
      log(`预计迁移 ${totalSqlite} 行数据（${TABLE_ORDER.length} 张表）。`);
      return;
    }

    // Step 2: 执行迁移
    log("🚀 开始迁移数据...\n");

    for (const table of TABLE_ORDER) {
      const count = sqliteCounts[table];
      if (count === 0) {
        log(`  ⏭️  ${table}: 0 行，跳过`);
        continue;
      }

      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

      const model = p[toModelName(table)];
      if (!model) {
        console.error(`  ❌ ${table}: Prisma model "${toModelName(table)}" 未找到`);
        continue;
      }

      let written = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const cleanedBatch = batch.map((row) => convertRow(table, row));
        await model.createMany({ data: cleanedBatch });
        written += batch.length;
      }

      log(`  ✅ ${table}: ${written}/${count} 行已迁移`);
    }

    // Step 3: 验证
    log("\n📊 验证迁移结果...\n");

    let allMatch = true;
    for (const table of TABLE_ORDER) {
      const pgCount = await p[toModelName(table)]?.count() ?? -1;
      const sqliteCount = sqliteCounts[table];
      const match = pgCount === sqliteCount;
      if (!match) allMatch = false;
      const icon = match ? "✅" : "❌";
      log(`  ${icon} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
    }

    console.log("");
    if (allMatch) {
      log("🎉 迁移成功！所有表行数完全匹配。");
    } else {
      log("⚠️  部分表行数不匹配，请手动检查。");
    }

  } finally {
    sqlite.close();
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ 迁移失败:", err);
  process.exit(1);
});
