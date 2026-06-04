/**
 * 素材卡类型迁移脚本
 *
 * 将旧的 5 种卡片类型映射到新的申论场景分类：
 *   fact_summary      → case_material      （案例素材）
 *   argument_analysis → reason_analysis     （原因分析）
 *   data_highlight    → case_material      （案例素材）
 *   policy_compare    → policy_expression   （政策表述）
 *   case_study        → case_material       （案例素材）
 *
 * 使用方法：
 *   npx tsx scripts/migrate-card-types.ts              # dry-run（仅打印映射）
 *   npx tsx scripts/migrate-card-types.ts --execute     # 实际执行迁移
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const LEGACY_TYPE_MAP: Record<string, string> = {
  fact_summary: "case_material",
  argument_analysis: "reason_analysis",
  data_highlight: "case_material",
  policy_compare: "policy_expression",
  case_study: "case_material",
};

const NEW_TYPE_LABELS: Record<string, string> = {
  golden_sentence: "申论金句",
  standard_expression: "规范词",
  case_material: "案例素材",
  countermeasure: "对策表达",
  problem_statement: "问题表述",
  reason_analysis: "原因分析",
  policy_expression: "政策表述",
  person_story: "人物事迹",
  article_structure: "文章框架",
};

async function main() {
  const isExecute = process.argv.includes("--execute");
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Find all cards with legacy types
    const legacyTypes = Object.keys(LEGACY_TYPE_MAP);
    const cards = await prisma.materialCard.findMany({
      where: {
        cardType: { in: legacyTypes },
      },
      select: {
        id: true,
        cardType: true,
        title: true,
        contentItemId: true,
      },
    });

    console.log(`\n📊 找到 ${cards.length} 张需要迁移的素材卡\n`);

    if (cards.length === 0) {
      console.log("✅ 没有需要迁移的卡片，所有卡片已是新类型。");
      return;
    }

    // Group by old type
    const grouped: Record<string, typeof cards> = {};
    for (const card of cards) {
      if (!grouped[card.cardType]) grouped[card.cardType] = [];
      grouped[card.cardType].push(card);
    }

    console.log("映射关系：");
    console.log("─".repeat(60));
    for (const [oldType, oldCards] of Object.entries(grouped)) {
      const newType = LEGACY_TYPE_MAP[oldType];
      const newLabel = NEW_TYPE_LABELS[newType] ?? newType;
      console.log(
        `  ${oldType} → ${newType}（${newLabel}）：${oldCards.length} 张`
      );
    }
    console.log("─".repeat(60));

    if (!isExecute) {
      console.log(
        "\n⚠️  这是 dry-run 模式。确认无误后，使用 --execute 参数执行迁移："
      );
      console.log("   npx tsx scripts/migrate-card-types.ts --execute\n");
      return;
    }

    // Execute migration
    console.log("\n🔄 开始执行迁移...\n");

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const card of cards) {
      const newType = LEGACY_TYPE_MAP[card.cardType];
      if (!newType) {
        console.log(`  ⏭️  跳过 ${card.id}（${card.cardType}）：无映射关系`);
        skipped++;
        continue;
      }

      try {
        // Check if a card with the new type already exists for this content item
        const existing = await prisma.materialCard.findFirst({
          where: {
            contentItemId: card.contentItemId,
            cardType: newType,
            id: { not: card.id },
          },
        });

        if (existing) {
          console.log(
            `  ⏭️  跳过 ${card.id}（${card.cardType} → ${newType}）：目标类型已存在`
          );
          skipped++;
          continue;
        }

        await prisma.materialCard.update({
          where: { id: card.id },
          data: { cardType: newType },
        });

        console.log(
          `  ✅ ${card.id}：${card.cardType} → ${newType}（${card.title.slice(0, 30)}...）`
        );
        migrated++;
      } catch (err) {
        console.error(
          `  ❌ ${card.id}：迁移失败 - ${err instanceof Error ? err.message : "unknown"}`
        );
        errors++;
      }
    }

    console.log("\n" + "─".repeat(60));
    console.log(
      `迁移完成：✅ 成功 ${migrated} | ⏭️ 跳过 ${skipped} | ❌ 失败 ${errors}`
    );
    console.log("─".repeat(60));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("迁移脚本执行失败:", err);
  process.exit(1);
});
