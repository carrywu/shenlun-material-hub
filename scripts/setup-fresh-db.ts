/**
 * 空库迁移与首启验收脚本
 *
 * 功能：一键完成 migrate → seed → health check
 * 用法：
 *   pnpm db:setup          # 完整执行
 *   pnpm db:setup:dry      # 仅输出步骤，不执行
 *   pnpm db:setup:seed     # 跳过迁移，只执行 seed
 *
 * 环境变量：
 *   DATABASE_URL           — SQLite 路径（默认 file:./prisma/dev.db）
 *   ADMIN_USERNAME         — 管理员用户名（默认 admin）
 *   ADMIN_PASSWORD         — 管理员密码（生产环境必须设置）
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ─── CLI 参数解析 ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const skipMigrate = args.includes("--skip-migrate");
const skipSeed = args.includes("--skip-seed");

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function log(step: string, message: string) {
  const prefix = isDryRun ? "[DRY-RUN]" : "[SETUP]";
  console.log(`${prefix} [${step}] ${message}`);
}

function run(cmd: string, step: string): boolean {
  if (isDryRun) {
    log(step, `将执行: ${cmd}`);
    return true;
  }
  try {
    execSync(cmd, { stdio: "inherit", env: { ...process.env } });
    return true;
  } catch (error) {
    log(step, `执行失败: ${cmd}`);
    console.error(error);
    return false;
  }
}

function fail(step: string, message: string): never {
  console.error(`[SETUP] [${step}] ❌ ${message}`);
  process.exit(1);
}

// ─── 步骤 1: Prisma 迁移 ──────────────────────────────────────────────────────

function stepMigrate(): boolean {
  const step = "MIGRATE";
  log(step, "开始执行 Prisma 迁移...");

  // 检查 prisma/migrations 目录
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  if (!existsSync(migrationsDir)) {
    fail(step, "prisma/migrations 目录不存在，无法执行迁移");
  }

  return run("npx prisma migrate deploy", step);
}

// ─── 步骤 2: 生成 Prisma Client ──────────────────────────────────────────────

function stepGenerate(): boolean {
  const step = "GENERATE";
  log(step, "生成 Prisma Client...");
  return run("npx prisma generate", step);
}

// ─── 步骤 3: Seed ─────────────────────────────────────────────────────────────

async function stepSeed(): Promise<boolean> {
  const step = "SEED";

  if (isDryRun) {
    log(step, "将按顺序执行 seed 脚本:");
    log(step, "  1. tsx src/scripts/seed-admin.ts");
    log(step, "  2. pnpm seed:accounts");
    log(step, "  3. pnpm seed:channels");
    return true;
  }

  // seed-admin（幂等）
  log(step, "执行 seed-admin...");
  if (!run("pnpm tsx src/scripts/seed-admin.ts", step)) {
    fail(step, "seed-admin 执行失败");
  }

  // seed-accounts（幂等）
  log(step, "执行 seed-accounts...");
  if (!run("pnpm seed:accounts", step)) {
    log(step, "seed-accounts 失败，继续执行（可能来源已存在）");
  }

  // seed-channels（幂等）
  log(step, "执行 seed-channels...");
  if (!run("pnpm seed:channels", step)) {
    log(step, "seed-channels 失败，继续执行（可能栏目已存在）");
  }

  return true;
}

// ─── 步骤 4: Health Check ─────────────────────────────────────────────────────

async function stepHealthCheck(): Promise<boolean> {
  const step = "HEALTH";

  if (isDryRun) {
    log(step, "将验证:");
    log(step, "  - 核心表存在（User, Source, ContentItem）");
    log(step, "  - 至少一个管理员用户存在");
    return true;
  }

  try {
    // Use require for CJS compatibility in scripts/
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { PrismaClient } = require("../src/generated/prisma") as { PrismaClient: any };
    const prisma = new PrismaClient();

    // 检查核心表
    const userCount = await prisma.user.count();
    const sourceCount = await prisma.source.count();
    const contentItemCount = await prisma.contentItem.count();

    log(step, `表检查: User=${userCount}, Source=${sourceCount}, ContentItem=${contentItemCount}`);

    // 检查管理员
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount === 0) {
      fail(step, "未找到管理员用户，seed-admin 可能失败");
    }

    log(step, `管理员用户: ${adminCount} 个`);
    log(step, "✅ 健康检查通过");

    await prisma.$disconnect();
    return true;
  } catch (error) {
    fail(step, `健康检查失败: ${error}`);
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  shenlun-material-hub 空库初始化与验收");
  console.log(`  模式: ${isDryRun ? "DRY-RUN（仅预览）" : "执行"}`);
  console.log(`  数据库: ${process.env.DATABASE_URL || "file:./prisma/dev.db"}`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");

  // Step 1: 迁移
  if (!skipMigrate) {
    if (!stepMigrate()) fail("MIGRATE", "迁移失败");
  } else {
    log("MIGRATE", "跳过（--skip-migrate）");
  }

  // Step 2: 生成 Client
  if (!skipMigrate) {
    if (!stepGenerate()) fail("GENERATE", "生成 Prisma Client 失败");
  }

  // Step 3: Seed
  if (!skipSeed) {
    await stepSeed();
  } else {
    log("SEED", "跳过（--skip-seed）");
  }

  // Step 4: Health Check
  await stepHealthCheck();

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log(isDryRun ? "  DRY-RUN 完成 — 未执行任何操作" : "  ✅ 初始化完成");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
}

main().catch((e) => {
  console.error("初始化失败:", e);
  process.exit(1);
});
