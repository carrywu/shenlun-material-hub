/**
 * 历史数据迁移脚本 — 为现有数据设置 ownerUserId 和 visibility
 *
 * 用法：
 *   npx tsx src/scripts/migrate-owner-userid.ts           # dry-run（默认）
 *   npx tsx src/scripts/migrate-owner-userid.ts --apply    # 实际执行
 */

async function main() {
  const { PrismaClient } = await import("../generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://shenlun:shenlun_dev@localhost:5432/shenlun_material_hub",
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const isApply = process.argv.includes("--apply");

  console.log(`\n📦 历史数据迁移 — 设置 ownerUserId 和 visibility`);
  console.log(`模式: ${isApply ? "✅ APPLY（实际执行）" : "🔍 DRY-RUN（预览）"}\n`);

  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    console.error("❌ 未找到 ADMIN 用户。请先运行 seed-admin 或确保至少有一个管理员。");
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`👤 管理员用户: ${admin.username} (${admin.id})\n`);

  // Count records needing migration
  const contentItemsWithoutOwner = await prisma.contentItem.count({
    where: { ownerUserId: null },
  });
  const materialCardsWithoutOwner = await prisma.materialCard.count({
    where: { ownerUserId: null },
  });
  const annotationsWithoutUser = await prisma.articleAnnotation.count({
    where: { userId: null },
  });
  const asyncTasksWithoutUser = await prisma.asyncTask.count({
    where: { userId: null },
  });
  const syncRecordsWithoutUser = await prisma.syncRecord.count({
    where: { userId: null },
  });

  console.log("📊 需要迁移的记录数:");
  console.log(`   ContentItem (ownerUserId=null): ${contentItemsWithoutOwner}`);
  console.log(`   MaterialCard (ownerUserId=null): ${materialCardsWithoutOwner}`);
  console.log(`   ArticleAnnotation (userId=null): ${annotationsWithoutUser}`);
  console.log(`   AsyncTask (userId=null):         ${asyncTasksWithoutUser}`);
  console.log(`   SyncRecord (userId=null):        ${syncRecordsWithoutUser}`);
  console.log();

  if (!isApply) {
    console.log("🔍 DRY-RUN 模式 — 不执行任何修改。使用 --apply 参数实际执行。");
    await prisma.$disconnect();
    return;
  }

  // Apply migrations
  console.log("⏳ 执行迁移...");

  // ContentItem: set ownerUserId
  if (contentItemsWithoutOwner > 0) {
    const result = await prisma.contentItem.updateMany({
      where: { ownerUserId: null },
      data: {
        ownerUserId: admin.id,
      },
    });
    console.log(`   ✅ ContentItem: ${result.count} 条记录已更新`);
  }

  // MaterialCard: set ownerUserId
  if (materialCardsWithoutOwner > 0) {
    const result = await prisma.materialCard.updateMany({
      where: { ownerUserId: null },
      data: { ownerUserId: admin.id },
    });
    console.log(`   ✅ MaterialCard: ${result.count} 条记录已更新`);
  }

  // ArticleAnnotation: set userId
  if (annotationsWithoutUser > 0) {
    const result = await prisma.articleAnnotation.updateMany({
      where: { userId: null },
      data: { userId: admin.id },
    });
    console.log(`   ✅ ArticleAnnotation: ${result.count} 条记录已更新`);
  }

  // AsyncTask: set userId
  if (asyncTasksWithoutUser > 0) {
    const result = await prisma.asyncTask.updateMany({
      where: { userId: null },
      data: { userId: admin.id },
    });
    console.log(`   ✅ AsyncTask: ${result.count} 条记录已更新`);
  }

  // SyncRecord: set userId
  if (syncRecordsWithoutUser > 0) {
    const result = await prisma.syncRecord.updateMany({
      where: { userId: null },
      data: { userId: admin.id },
    });
    console.log(`   ✅ SyncRecord: ${result.count} 条记录已更新`);
  }

  console.log("\n🎉 迁移完成!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ 迁移失败:", e);
  process.exit(1);
});
