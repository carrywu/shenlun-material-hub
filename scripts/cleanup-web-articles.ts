/**
 * 清理脚本：删除本地 web_collector 文章（旧格式、无 rawHtml），用于重新采集验收正文格式修复。
 *
 * 背景：上一轮已修复采集链路（双写 rawHtml + 结构化 fullText）。为干净验收，
 * 先删除旧的 476 篇 web_collector 文章（platform='website'），再用修复后的代码重新采集。
 *
 * 安全约束：
 *  - 默认 --dry-run，只读不写；必须显式 --execute 才删除。
 *  - 严格限定 discoveryChannel='web_collector'，绝不触碰 wechat-api / mediacrawler / manual。
 *  - 删除会级联删除 6 张子表（MaterialCard / ArticleAnnotation / ArticleFavorite /
 *    ArticleReviewState / SyncRecord / UserContentState）。脚本先统计并显式警告这些数量。
 *  - 单事务（deleteMany），失败回滚。
 *
 * 用法：
 *   pnpm tsx scripts/cleanup-web-articles.ts --dry-run                 # 预览（默认）
 *   pnpm tsx scripts/cleanup-web-articles.ts --dry-run --source=人民网观点
 *   pnpm tsx scripts/cleanup-web-articles.ts --execute                 # 真正删除
 *   pnpm tsx scripts/cleanup-web-articles.ts --execute --source=湖南省政府网
 */
// 加载 .env（tsx 不自动加载；必须在 import db 之前）
import "dotenv/config";
import { db } from "../src/lib/db";

interface CliArgs {
  dryRun: boolean;
  execute: boolean;
  source: string | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (key: string): string | null => {
    const hit = argv.find((a) => a === `--${key}` || a.startsWith(`--${key}=`));
    if (!hit) return null;
    if (hit === `--${key}`) return "";
    return hit.slice(`--${key}=`.length);
  };
  const execute = argv.includes("--execute");
  return {
    dryRun: !execute,
    execute,
    source: get("source"),
  };
}

async function main() {
  const args = parseArgs();
  const start = Date.now();

  const where = {
    discoveryChannel: "web_collector" as const,
    ...(args.source ? { source: { name: args.source } } : {}),
  };

  console.log("=".repeat(70));
  console.log("清理 web_collector 文章");
  console.log(`模式：${args.execute ? "EXECUTE（实际删除）" : "DRY-RUN（只读，不写入）"}`);
  if (args.source) console.log(`来源筛选：${args.source}`);
  else console.log("范围：全部 web_collector 文章（不区分来源）");
  console.log("=".repeat(70));

  // 1. 统计待删文章
  const articleCount = await db.contentItem.count({ where });
  if (articleCount === 0) {
    console.log("\n无匹配的 web_collector 文章，无需删除。");
    return;
  }

  // 2. 统计会级联删除的子表数据
  const targetItems = await db.contentItem.findMany({
    where,
    select: { id: true },
  });
  const ids = targetItems.map((i) => i.id);

  const [cards, annotations, favorites, reviewStates, userStates, syncRecords] =
    await Promise.all([
      db.materialCard.count({ where: { contentItemId: { in: ids } } }),
      db.articleAnnotation.count({ where: { contentItemId: { in: ids } } }),
      db.articleFavorite.count({ where: { contentItemId: { in: ids } } }),
      db.articleReviewState.count({ where: { contentItemId: { in: ids } } }),
      db.userContentState.count({ where: { contentItemId: { in: ids } } }),
      db.syncRecord.count({ where: { contentItemId: { in: ids } } }),
    ]);

  console.log(`\n将删除 ${articleCount} 篇 web_collector 文章`);
  console.log("⚠ 级联删除（onDelete: Cascade）：");
  console.log(`    MaterialCard      素材卡：${cards}`);
  console.log(`    ArticleAnnotation 批注：${annotations}`);
  console.log(`    ArticleFavorite   收藏：${favorites}`);
  console.log(`    ArticleReviewState 复习状态：${reviewStates}`);
  console.log(`    UserContentState  阅读/忽略状态：${userStates}`);
  console.log(`    SyncRecord        同步记录：${syncRecords}`);
  if (cards > 0 || annotations > 0) {
    console.log("  （这些是 admin 账号的测试数据，重新采集后可再生成）");
  }

  if (args.dryRun) {
    console.log("\n[DRY-RUN] 未写入。确认后用 --execute 执行删除。");
    return;
  }

  // 3. 执行删除（单事务，Prisma 自动级联删子表）
  const result = await db.contentItem.deleteMany({ where });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✓ 已删除 ${result.count} 篇 web_collector 文章（含级联子表数据），耗时 ${elapsed}s`);

  // 4. 复核
  const remaining = await db.contentItem.count({
    where: { discoveryChannel: "web_collector" },
  });
  console.log(`✓ 复核：剩余 web_collector 文章 ${remaining} 篇`);
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("脚本异常：", e);
    process.exit(1);
  });
