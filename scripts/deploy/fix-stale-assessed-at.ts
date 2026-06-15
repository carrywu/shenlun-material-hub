/**
 * 修复因评估失败但被错误设置 aiAssessedAt 的记录
 *
 * Bug 根因：assess/route.ts 错误处理中曾设置 aiAssessedAt: new Date()，
 * 导致评估失败的文章也被标记为"已评估"。此脚本清理这些错误标记。
 *
 * 用法：
 *   # 本地开发数据库
 *   pnpm tsx scripts/deploy/fix-stale-assessed-at.ts
 *
 *   # 通过 SSH 隧道连接线上数据库
 *   # 先开隧道: ssh -L 15432:localhost:5432 root@47.119.182.210
 *   # DATABASE_URL=postgresql://shenlun:PASSWORD@localhost:15432/shenlun_material_hub pnpm tsx scripts/deploy/fix-stale-assessed-at.ts
 *
 *   # Dry-run（仅查看受影响的行数，不执行更新）
 *   pnpm tsx scripts/deploy/fix-stale-assessed-at.ts --dry-run
 */

import { db } from "@/lib/db";

const isDryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");

async function main() {
  console.log("=== 修复被错误标记 aiAssessedAt 的记录 ===\n");
  console.log(`模式: ${isDryRun ? "DRY-RUN（仅查询，不修改）" : "执行（将更新记录）"}\n`);

  // 查询受影响的记录数
  const affectedCount = await db.contentItem.count({
    where: {
      aiDecision: null,
      aiAssessedAt: { not: null },
      aiAssessmentError: { not: null },
    },
  });

  console.log(`受影响的记录数: ${affectedCount}`);

  if (affectedCount === 0) {
    console.log("\n✅ 没有需要修复的记录，数据库状态正常。");
    return;
  }

  // 显示几条示例记录
  const samples = await db.contentItem.findMany({
    where: {
      aiDecision: null,
      aiAssessedAt: { not: null },
      aiAssessmentError: { not: null },
    },
    select: {
      id: true,
      title: true,
      aiAssessedAt: true,
      aiAssessmentError: true,
    },
    take: 5,
  });

  console.log("\n示例记录（前 5 条）:");
  for (const item of samples) {
    console.log(
      `  - [${item.id}] "${item.title}"\n` +
      `    aiAssessedAt=${item.aiAssessedAt?.toISOString()}, aiAssessmentError="${item.aiAssessmentError?.substring(0, 80)}..."`
    );
  }

  if (isDryRun) {
    console.log(`\n🔍 DRY-RUN: 将清除 ${affectedCount} 条记录的 aiAssessedAt`);
    return;
  }

  // 执行修复
  const result = await db.contentItem.updateMany({
    where: {
      aiDecision: null,
      aiAssessedAt: { not: null },
      aiAssessmentError: { not: null },
    },
    data: {
      aiAssessedAt: null,
    },
  });

  console.log(`\n✅ 已修复 ${result.count} 条记录（aiAssessedAt 设为 NULL）`);

  // 验证修复结果
  const remainingCount = await db.contentItem.count({
    where: {
      aiDecision: null,
      aiAssessedAt: { not: null },
      aiAssessmentError: { not: null },
    },
  });

  console.log(`验证: 剩余受影响记录数: ${remainingCount}`);

  if (remainingCount > 0) {
    console.log("⚠️ 仍有记录未修复，请检查数据");
  } else {
    console.log("✅ 所有错误标记已清理完毕");
  }
}

main()
  .catch((e) => {
    console.error("❌ 修复脚本执行失败:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
