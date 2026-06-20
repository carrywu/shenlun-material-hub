/**
 * 回填脚本：为历史 web_collector 文章补充 rawHtml + 结构化 fullText。
 *
 * 背景：旧采集链路用 .text() 抠正文且从不存 rawHtml，导致详情页正文挤成一段、
 * 格式丢失。新采集链路已修复（双写 rawHtml + 结构化 fullText）。本脚本对历史文章
 * 按原文 URL 重新抓取并用统一提取器生成 rawHtml/fullText，回填入库。
 *
 * 安全约束：
 *  - 默认 --dry-run，只读不写。
 *  - 只更新正文相关字段：rawHtml / fullText / excerpt / contentHash /
 *    effectiveTextLength / fullTextStored。
 *  - 不触碰：标题/URL/作者/时间/AI 评估（ai* 全部保留）/ 审核状态/收藏/阅读/批注/素材卡。
 *  - contentHash 会变化 → 已评估过的文章会显示「评估过期」（不自动重评，符合预期）。
 *  - 单篇失败不终止批次；原文失效保留旧正文（SKIP）。
 *  - 限流：每篇之间 delay（默认 1200ms）。
 *
 * 用法：
 *   pnpm tsx scripts/backfill-article-format.ts --dry-run
 *   pnpm tsx scripts/backfill-article-format.ts --dry-run --source=湖南省政府网
 *   pnpm tsx scripts/backfill-article-format.ts --dry-run --limit=20
 *   pnpm tsx scripts/backfill-article-format.ts --dry-run --article-id=<id>
 *   pnpm tsx scripts/backfill-article-format.ts --execute           # 真正写入
 *   pnpm tsx scripts/backfill-article-format.ts --execute --delay-ms=2000
 */
// 加载 .env（tsx 不自动加载；必须在 import db 之前加载，否则 DATABASE_URL 为空）
import "dotenv/config";
import { db } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { getCollector } from "../src/services/collectors/registry";
import {
  computeArticleContentHash,
  computeEffectiveLength,
} from "../src/services/collectors/content-extractor";
import { extractPlainText } from "../src/services/collectors/wechat/weRssNormalizer";

interface CliArgs {
  dryRun: boolean;
  execute: boolean;
  limit: number | null;
  source: string | null;
  articleId: string | null;
  delayMs: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (key: string): string | null => {
    const hit = argv.find((a) => a === `--${key}` || a.startsWith(`--${key}=`));
    if (!hit) return null;
    if (hit === `--${key}`) return "";
    return hit.slice(`--${key}=`.length);
  };
  const has = (key: string): boolean => argv.includes(`--${key}`);

  const execute = has("execute");
  return {
    dryRun: !execute, // 默认 dry-run
    execute,
    limit: get("limit") ? parseInt(get("limit")!, 10) : null,
    source: get("source"),
    articleId: get("article-id"),
    delayMs: get("delay-ms") ? parseInt(get("delay-ms")!, 10) : 1200,
  };
}

interface BackfillTarget {
  id: string;
  title: string;
  originalUrl: string;
  sourceName: string;
  fullText: string | null;
  rawHtml: string | null;
  contentHash: string | null;
  effectiveTextLength: number;
  aiAssessedAt: Date | null;
}

interface BackfillResult {
  status: "OK" | "SKIP" | "FAIL";
  id: string;
  url: string;
  reason?: string;
  oldLen?: number;
  newLen?: number;
  hashChanged?: boolean;
  rawHtmlAdded?: boolean;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchTargets(args: CliArgs): Promise<BackfillTarget[]> {
  const where: Record<string, unknown> = {
    discoveryChannel: "web_collector",
  };
  if (args.articleId) {
    where.id = args.articleId;
  } else if (args.source) {
    where.source = { name: args.source };
  }

  const items = await db.contentItem.findMany({
    where,
    include: { source: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    ...(args.limit ? { take: args.limit } : {}),
  });

  return items.map((it) => ({
    id: it.id,
    title: it.title,
    originalUrl: it.originalUrl,
    sourceName: it.source?.name ?? "(unknown)",
    fullText: it.fullText,
    rawHtml: it.rawHtml,
    contentHash: it.contentHash,
    effectiveTextLength: it.effectiveTextLength,
    aiAssessedAt: it.aiAssessedAt,
  }));
}

/**
 * 判断是否为 RSS 类文章（fullText 含 HTML 块级标签）。
 * RSS 文章的 content:encoded 比网页正文更全，不应重新抓网页，
 * 直接把现有 fullText 当 HTML 重新生成 rawHtml + 结构化 fullText。
 */
function isRssLikeHtml(fullText: string | null): boolean {
  if (!fullText) return false;
  return /<(p|div|br|span|h[1-6]|ul|ol|li|table|blockquote)\b/i.test(fullText);
}

// extractArticleDetail 是 protected，通过 as any 访问（脚本内部，不暴露公开 API）
type AnyCollector = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractArticleDetail(url: string): Promise<{
    fullText: string;
    rawHtml?: string;
    publishedAt?: Date;
    author?: string;
  } | null>;
};

async function processOne(
  target: BackfillTarget,
  args: CliArgs,
  startTime: Date
): Promise<BackfillResult> {
  const base: BackfillResult = {
    status: "SKIP",
    id: target.id,
    url: target.originalUrl,
    oldLen: target.effectiveTextLength,
  };

  // 竞态保护：脚本开始后才被 AI 评估的文章跳过，避免刚评估完立刻被标 stale
  if (target.aiAssessedAt && target.aiAssessedAt > startTime) {
    return { ...base, reason: "脚本运行期间被重新评估，跳过" };
  }

  let fullText: string;
  let rawHtml: string | null;

  if (isRssLikeHtml(target.fullText)) {
    // RSS 类：不重新抓网页，把现有 fullText(HTML) 转 rawHtml + 结构化纯文本
    rawHtml = target.fullText;
    fullText = extractPlainText(target.fullText) || "";
    if (!fullText) {
      return { ...base, reason: "RSS HTML 转纯文本为空" };
    }
  } else {
    // 普通网页：用对应采集器重新抓取 + 提取（复用选择器 + fetchWithRetry，含 hunan HTTP 降级）
    const collector = getCollector({ name: target.sourceName }) as AnyCollector | null;
    if (!collector) {
      return { ...base, reason: `无匹配采集器（source=${target.sourceName}，孤儿文章跳过）` };
    }
    try {
      const detail = await collector.extractArticleDetail(target.originalUrl);
      if (!detail || !detail.fullText) {
        return { ...base, reason: "重新抓取未获取到正文（原文可能失效）" };
      }
      fullText = detail.fullText;
      rawHtml = detail.rawHtml ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...base, status: "FAIL", reason: `重新抓取异常：${msg.slice(0, 80)}` };
    }
  }

  const newEffectiveLen = computeEffectiveLength(fullText);
  const newHash = computeArticleContentHash(fullText);
  const hashChanged = target.contentHash !== newHash;
  const rawHtmlAdded = !target.rawHtml && !!rawHtml;

  const result: BackfillResult = {
    ...base,
    status: "OK",
    newLen: newEffectiveLen,
    hashChanged,
    rawHtmlAdded,
  };

  if (args.dryRun) {
    return result;
  }

  // 写入：只更新正文相关字段，绝不触碰 ai* / 审核状态 / 用户数据
  await db.contentItem.update({
    where: { id: target.id },
    data: {
      rawHtml,
      fullText,
      excerpt: fullText.slice(0, 200),
      contentHash: newHash,
      effectiveTextLength: newEffectiveLen,
      fullTextStored: !!fullText,
    },
  });

  return result;
}

async function main() {
  const args = parseArgs();
  const startTime = new Date();

  console.log("=".repeat(70));
  console.log("文章格式回填脚本");
  console.log(`模式：${args.dryRun ? "DRY-RUN（只读，不写入）" : "EXECUTE（实际写入）"}`);
  if (args.source) console.log(`来源筛选：${args.source}`);
  if (args.articleId) console.log(`文章 ID：${args.articleId}`);
  if (args.limit) console.log(`数量限制：${args.limit}`);
  console.log(`限流：每篇 ${args.delayMs}ms`);
  console.log("=".repeat(70));

  const targets = await fetchTargets(args);
  console.log(`\n目标文章数：${targets.length}\n`);

  if (targets.length === 0) {
    console.log("无目标文章，退出。");
    return;
  }

  const results: BackfillResult[] = [];
  let i = 0;
  for (const target of targets) {
    i++;
    const res = await processOne(target, args, startTime);
    results.push(res);

    const tag = res.status.padEnd(4);
    const lenInfo = res.newLen != null
      ? `len ${res.oldLen ?? "?"}→${res.newLen}`
      : "";
    const hashInfo = res.hashChanged ? "hash✱" : "";
    const rawInfo = res.rawHtmlAdded ? "rawHtml+" : "";
    const reasonInfo = res.reason ? ` | ${res.reason}` : "";
    console.log(
      `[${i}/${targets.length}] ${tag} ${lenInfo} ${hashInfo} ${rawInfo}${reasonInfo} | ${target.title.slice(0, 24)}`
    );

    // 限流（最后一篇不 sleep）
    if (i < targets.length && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  // 汇总
  const ok = results.filter((r) => r.status === "OK").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const hashChanged = results.filter((r) => r.hashChanged).length;
  const rawAdded = results.filter((r) => r.rawHtmlAdded).length;

  console.log("\n" + "=".repeat(70));
  console.log("汇总");
  console.log(`  成功（OK）：${ok}`);
  console.log(`  跳过（SKIP）：${skip}`);
  console.log(`  失败（FAIL）：${fail}`);
  console.log(`  contentHash 变化：${hashChanged}`);
  console.log(`  新增 rawHtml：${rawAdded}`);
  console.log(`  模式：${args.dryRun ? "DRY-RUN（未写入）" : "EXECUTE（已写入）"}`);
  if (hashChanged > 0) {
    console.log(
      `\n  注：${hashChanged} 篇 contentHash 变化，已评估过的文章会显示「评估过期」\n  （不自动重评，需手动触发）。`
    );
  }
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    await logger.error("回填脚本异常", "CRAWLER", e instanceof Error ? e.message : String(e));
    console.error("脚本异常：", e);
    process.exit(1);
  });
