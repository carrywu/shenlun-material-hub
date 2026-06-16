/**
 * WeWe RSS → we-mp-rss 数据迁移脚本
 *
 * 将数据库中所有 wewe-rss / werss-external 相关数据迁移到 we-mp-rss：
 *   1. Source.provider:             "wewe-rss"       → "we-mp-rss"
 *   2. Source.provider:             "werss-external"  → 软删除（设 archivedAt）
 *   3. Source.baseUrl:              wewe-rss 格式     → we-mp-rss 格式
 *   4. ContentItem.discoveryChannel: "werss"           → "wechat-api"
 *   5. AsyncTask.type:              "WEWE_RSS_SYNC"   → "WECHAT_SYNC"
 *   6. UserIntegration.provider:    "wewe-rss"        → "we-mp-rss"（合并 werss-external）
 *   7. CollectorRun.collectorType:  "werss"           → "wechat-api"
 *
 * 使用方法：
 *   npx tsx scripts/migrate-wewe-to-we-mp-rss.ts              # dry-run（仅打印映射）
 *   npx tsx scripts/migrate-wewe-to-we-mp-rss.ts --apply      # 实际执行迁移
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ── 映射关系 ──────────────────────────────────────────────────

const _SOURCE_PROVIDER_MAP: Record<string, string | null> = {
  "wewe-rss": "we-mp-rss",
  // "werss-external" → 不改 provider，而是软删除（设 archivedAt）
};

const DISCOVERY_CHANNEL_MAP: Record<string, string> = {
  werss: "wechat-api",
  "wewe-rss": "wechat-api",
};

const ASYNC_TASK_TYPE_MAP: Record<string, string> = {
  WEWE_RSS_SYNC: "WECHAT_SYNC",
};

const COLLECTOR_TYPE_MAP: Record<string, string> = {
  werss: "wechat-api",
  "wewe-rss": "wechat-api",
};

const USER_INTEGRATION_PROVIDER_MAP: Record<string, string> = {
  "wewe-rss": "we-mp-rss",
  "werss-external": "we-mp-rss",
};

// ── 统计计数 ──────────────────────────────────────────────────

interface MigrationStats {
  sourceProviderUpdated: number;
  sourceSoftDeleted: number;         // werss-external → archivedAt
  sourceBaseUrlUpdated: number;
  contentItemChannelUpdated: number;
  asyncTaskTypeUpdated: number;
  userIntegrationUpdated: number;
  userIntegrationMerged: number;      // werss-external 行合并后删除
  collectorRunTypeUpdated: number;
  errors: number;
}

const defaultStats = (): MigrationStats => ({
  sourceProviderUpdated: 0,
  sourceSoftDeleted: 0,
  sourceBaseUrlUpdated: 0,
  contentItemChannelUpdated: 0,
  asyncTaskTypeUpdated: 0,
  userIntegrationUpdated: 0,
  userIntegrationMerged: 0,
  collectorRunTypeUpdated: 0,
  errors: 0,
});

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 将旧 wewe-rss baseUrl 转换为 we-mp-rss 格式
 * 旧格式: http://host:4000/feeds/MP_xxx.rss 或 http://host:4000
 * 新格式: http://host:8001
 */
function migrateBaseUrl(oldBaseUrl: string | null): string | null {
  if (!oldBaseUrl) return null;

  // 已经是新格式，跳过
  if (oldBaseUrl.includes(":8001")) return oldBaseUrl;

  // 旧 wewe-rss 格式：提取 host 部分，替换端口
  const match = oldBaseUrl.match(/^(https?:\/\/[^:/]+)(?::\d+)?/);
  if (match) {
    return `${match[1]}:8001`;
  }

  return oldBaseUrl;
}

/**
 * 合并 UserIntegration config JSON
 * 旧 config 可能含 { baseUrl, authCode, dbPath }
 * 新 config 需要 { baseUrl, accessKey, secretKey, dbPath }
 */
function migrateUserIntegrationConfig(oldConfig: string): string {
  try {
    const parsed = JSON.parse(oldConfig);
    // 移除旧的 authCode，保留其余
    const { authCode: _authCode, ...rest } = parsed;
    // 确保有 accessKey/secretKey 占位（用户需后续手动填入）
    if (!rest.accessKey) rest.accessKey = "";
    if (!rest.secretKey) rest.secretKey = "";
    return JSON.stringify(rest);
  } catch {
    // 如果不是有效 JSON，返回原始值
    return oldConfig;
  }
}

// ── 主逻辑 ────────────────────────────────────────────────────

async function main() {
  const isApply = process.argv.includes("--apply");
  const mode = isApply ? "🔴 APPLY" : "🟡 DRY-RUN";

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://shenlun:shenlun_dev@localhost:5432/shenlun_material_hub",
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const stats = defaultStats();

  try {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  WeWe RSS → we-mp-rss 数据迁移  [${mode}]`);
    console.log(`${"═".repeat(70)}\n`);

    // ── 1. Source.provider 迁移 ──────────────────────────────
    console.log("📋 1. Source.provider 迁移");
    console.log("─".repeat(50));

    const weweSources = await prisma.source.findMany({
      where: { provider: "wewe-rss" },
      select: { id: true, name: true, provider: true, baseUrl: true },
    });

    console.log(`   找到 ${weweSources.length} 个 provider="wewe-rss" 的来源`);

    if (weweSources.length > 0 && !isApply) {
      for (const s of weweSources.slice(0, 5)) {
        console.log(`   → ${s.id.slice(0, 8)}… "${s.name}" : wewe-rss → we-mp-rss`);
      }
      if (weweSources.length > 5) {
        console.log(`   … 还有 ${weweSources.length - 5} 个`);
      }
    }

    if (isApply && weweSources.length > 0) {
      for (const s of weweSources) {
        try {
          await prisma.source.update({
            where: { id: s.id },
            data: { provider: "we-mp-rss" },
          });
          stats.sourceProviderUpdated++;
        } catch (err) {
          console.error(`   ❌ ${s.id}: ${err instanceof Error ? err.message : "unknown"}`);
          stats.errors++;
        }
      }
      console.log(`   ✅ 已更新 ${stats.sourceProviderUpdated} 个来源的 provider`);
    }

    // ── 2. werss-external 来源软删除 ─────────────────────────
    console.log("\n📋 2. werss-external 来源软删除");
    console.log("─".repeat(50));

    const werssExtSources = await prisma.source.findMany({
      where: { provider: "werss-external" },
      select: { id: true, name: true, provider: true, archivedAt: true },
    });

    console.log(`   找到 ${werssExtSources.length} 个 provider="werss-external" 的来源`);

    // 统计有多少已经是 archived 的
    const alreadyArchived = werssExtSources.filter((s) => s.archivedAt !== null).length;
    if (alreadyArchived > 0) {
      console.log(`   其中 ${alreadyArchived} 个已有 archivedAt，将跳过`);
    }

    const toArchive = werssExtSources.filter((s) => s.archivedAt === null);

    if (toArchive.length > 0 && !isApply) {
      for (const s of toArchive.slice(0, 5)) {
        console.log(`   → ${s.id.slice(0, 8)}… "${s.name}" : 设 archivedAt`);
      }
      if (toArchive.length > 5) {
        console.log(`   … 还有 ${toArchive.length - 5} 个`);
      }
      console.log("   ℹ️  注意：已入库文章不会被删除");
    }

    if (isApply && toArchive.length > 0) {
      const result = await prisma.source.updateMany({
        where: {
          provider: "werss-external",
          archivedAt: null,
        },
        data: { archivedAt: new Date() },
      });
      stats.sourceSoftDeleted = result.count;
      console.log(`   ✅ 已软删除 ${stats.sourceSoftDeleted} 个 werss-external 来源`);
    }

    // ── 3. Source.baseUrl 迁移 ──────────────────────────────
    console.log("\n📋 3. Source.baseUrl 迁移");
    console.log("─".repeat(50));

    // 查找所有 we-mp-rss 来源中 baseUrl 包含旧端口的
    const providerToCheck = isApply ? "we-mp-rss" : "wewe-rss";
    const sourcesWithOldBaseUrl = await prisma.source.findMany({
      where: {
        provider: providerToCheck,
        baseUrl: { not: null },
      },
      select: { id: true, name: true, baseUrl: true },
    });

    const needBaseUrlUpdate = sourcesWithOldBaseUrl.filter((s) => {
      const newUrl = migrateBaseUrl(s.baseUrl);
      return newUrl !== s.baseUrl;
    });

    console.log(`   找到 ${needBaseUrlUpdate.length} 个需要更新 baseUrl 的来源`);

    if (needBaseUrlUpdate.length > 0 && !isApply) {
      for (const s of needBaseUrlUpdate.slice(0, 5)) {
        console.log(`   → ${s.id.slice(0, 8)}… "${s.name}" : ${s.baseUrl} → ${migrateBaseUrl(s.baseUrl)}`);
      }
      if (needBaseUrlUpdate.length > 5) {
        console.log(`   … 还有 ${needBaseUrlUpdate.length - 5} 个`);
      }
    }

    if (isApply && needBaseUrlUpdate.length > 0) {
      for (const s of needBaseUrlUpdate) {
        try {
          const newUrl = migrateBaseUrl(s.baseUrl);
          await prisma.source.update({
            where: { id: s.id },
            data: { baseUrl: newUrl },
          });
          stats.sourceBaseUrlUpdated++;
        } catch (err) {
          console.error(`   ❌ ${s.id}: ${err instanceof Error ? err.message : "unknown"}`);
          stats.errors++;
        }
      }
      console.log(`   ✅ 已更新 ${stats.sourceBaseUrlUpdated} 个来源的 baseUrl`);
    }

    // ── 4. ContentItem.discoveryChannel 迁移 ─────────────────
    console.log("\n📋 4. ContentItem.discoveryChannel 迁移");
    console.log("─".repeat(50));

    const oldChannelValues = Object.keys(DISCOVERY_CHANNEL_MAP);
    const contentItemsWithOldChannel = await prisma.contentItem.findMany({
      where: {
        discoveryChannel: { in: oldChannelValues },
      },
      select: { id: true, discoveryChannel: true },
      take: 10, // 预览只取前 10 条
    });

    const totalContentItems = await prisma.contentItem.count({
      where: {
        discoveryChannel: { in: oldChannelValues },
      },
    });

    console.log(`   找到 ${totalContentItems} 个 discoveryChannel 需要迁移的内容项`);

    if (totalContentItems > 0 && !isApply) {
      for (const ci of contentItemsWithOldChannel) {
        const newChannel = DISCOVERY_CHANNEL_MAP[ci.discoveryChannel ?? ""] ?? ci.discoveryChannel;
        console.log(`   → ${ci.id.slice(0, 8)}… : ${ci.discoveryChannel} → ${newChannel}`);
      }
      if (totalContentItems > 10) {
        console.log(`   … 还有 ${totalContentItems - 10} 个`);
      }
    }

    if (isApply && totalContentItems > 0) {
      for (const [oldVal, newVal] of Object.entries(DISCOVERY_CHANNEL_MAP)) {
        const result = await prisma.contentItem.updateMany({
          where: { discoveryChannel: oldVal },
          data: { discoveryChannel: newVal },
        });
        stats.contentItemChannelUpdated += result.count;
      }
      console.log(`   ✅ 已更新 ${stats.contentItemChannelUpdated} 个内容项的 discoveryChannel`);
    }

    // ── 5. AsyncTask.type 迁移 ───────────────────────────────
    console.log("\n📋 5. AsyncTask.type 迁移");
    console.log("─".repeat(50));

    const oldTaskTypes = Object.keys(ASYNC_TASK_TYPE_MAP);
    const asyncTasksWithOldType = await prisma.asyncTask.findMany({
      where: {
        type: { in: oldTaskTypes },
      },
      select: { id: true, type: true },
    });

    console.log(`   找到 ${asyncTasksWithOldType.length} 个 type 需要迁移的异步任务`);

    if (asyncTasksWithOldType.length > 0 && !isApply) {
      for (const t of asyncTasksWithOldType.slice(0, 5)) {
        const newType = ASYNC_TASK_TYPE_MAP[t.type] ?? t.type;
        console.log(`   → ${t.id.slice(0, 8)}… : ${t.type} → ${newType}`);
      }
      if (asyncTasksWithOldType.length > 5) {
        console.log(`   … 还有 ${asyncTasksWithOldType.length - 5} 个`);
      }
    }

    if (isApply && asyncTasksWithOldType.length > 0) {
      for (const [oldVal, newVal] of Object.entries(ASYNC_TASK_TYPE_MAP)) {
        const result = await prisma.asyncTask.updateMany({
          where: { type: oldVal },
          data: { type: newVal },
        });
        stats.asyncTaskTypeUpdated += result.count;
      }
      console.log(`   ✅ 已更新 ${stats.asyncTaskTypeUpdated} 个异步任务的 type`);
    }

    // ── 6. UserIntegration.provider 迁移 ─────────────────────
    console.log("\n📋 6. UserIntegration.provider 迁移");
    console.log("─".repeat(50));

    const oldUIProviders = Object.keys(USER_INTEGRATION_PROVIDER_MAP);
    const userIntegrationsWithOldProvider = await prisma.userIntegration.findMany({
      where: {
        provider: { in: oldUIProviders },
      },
      select: { id: true, userId: true, provider: true, config: true },
    });

    console.log(`   找到 ${userIntegrationsWithOldProvider.length} 个 provider 需要迁移的用户集成`);

    // 检测唯一约束冲突：同一 userId 下同时有 wewe-rss 和 werss-external
    const userProviderMap = new Map<string, string[]>();
    for (const ui of userIntegrationsWithOldProvider) {
      if (!userProviderMap.has(ui.userId)) userProviderMap.set(ui.userId, []);
      userProviderMap.get(ui.userId)!.push(ui.provider);
    }

    const conflictUsers: string[] = [];
    for (const [userId, providers] of userProviderMap.entries()) {
      if (providers.includes("wewe-rss") && providers.includes("werss-external")) {
        conflictUsers.push(userId);
      }
    }

    if (conflictUsers.length > 0) {
      console.log(`   ⚠️  发现 ${conflictUsers.length} 个用户同时拥有 wewe-rss 和 werss-external 集成`);
      console.log("   处理策略：保留 wewe-rss 行（改 provider + config），删除 werss-external 行");
    }

    if (userIntegrationsWithOldProvider.length > 0 && !isApply) {
      for (const ui of userIntegrationsWithOldProvider.slice(0, 5)) {
        const newProvider = USER_INTEGRATION_PROVIDER_MAP[ui.provider] ?? ui.provider;
        console.log(`   → 用户 ${ui.userId.slice(0, 8)}… : ${ui.provider} → ${newProvider}`);
      }
      if (userIntegrationsWithOldProvider.length > 5) {
        console.log(`   … 还有 ${userIntegrationsWithOldProvider.length - 5} 个`);
      }
    }

    if (isApply && userIntegrationsWithOldProvider.length > 0) {
      // 先处理无冲突的：直接更新 provider
      for (const ui of userIntegrationsWithOldProvider) {
        const newProvider = USER_INTEGRATION_PROVIDER_MAP[ui.provider] ?? ui.provider;

        // 如果是 werss-external 且用户也有 wewe-rss，删除此行
        if (ui.provider === "werss-external" && conflictUsers.includes(ui.userId)) {
          try {
            await prisma.userIntegration.delete({ where: { id: ui.id } });
            stats.userIntegrationMerged++;
          } catch (err) {
            console.error(`   ❌ 删除冲突行 ${ui.id}: ${err instanceof Error ? err.message : "unknown"}`);
            stats.errors++;
          }
          continue;
        }

        try {
          await prisma.userIntegration.update({
            where: { id: ui.id },
            data: {
              provider: newProvider,
              config: migrateUserIntegrationConfig(ui.config),
            },
          });
          stats.userIntegrationUpdated++;
        } catch (err) {
          console.error(`   ❌ ${ui.id}: ${err instanceof Error ? err.message : "unknown"}`);
          stats.errors++;
        }
      }
      console.log(
        `   ✅ 已更新 ${stats.userIntegrationUpdated} 个用户集成，合并删除 ${stats.userIntegrationMerged} 个冲突行`
      );
    }

    // ── 7. CollectorRun.collectorType 迁移 ────────────────────
    console.log("\n📋 7. CollectorRun.collectorType 迁移");
    console.log("─".repeat(50));

    const oldCollectorTypes = Object.keys(COLLECTOR_TYPE_MAP);
    const collectorRunsWithOldType = await prisma.collectorRun.findMany({
      where: {
        collectorType: { in: oldCollectorTypes },
      },
      select: { id: true, collectorType: true },
    });

    console.log(`   找到 ${collectorRunsWithOldType.length} 个 collectorType 需要迁移的采集记录`);

    if (collectorRunsWithOldType.length > 0 && !isApply) {
      for (const cr of collectorRunsWithOldType.slice(0, 5)) {
        const newType = COLLECTOR_TYPE_MAP[cr.collectorType] ?? cr.collectorType;
        console.log(`   → ${cr.id.slice(0, 8)}… : ${cr.collectorType} → ${newType}`);
      }
      if (collectorRunsWithOldType.length > 5) {
        console.log(`   … 还有 ${collectorRunsWithOldType.length - 5} 个`);
      }
    }

    if (isApply && collectorRunsWithOldType.length > 0) {
      for (const [oldVal, newVal] of Object.entries(COLLECTOR_TYPE_MAP)) {
        const result = await prisma.collectorRun.updateMany({
          where: { collectorType: oldVal },
          data: { collectorType: newVal },
        });
        stats.collectorRunTypeUpdated += result.count;
      }
      console.log(`   ✅ 已更新 ${stats.collectorRunTypeUpdated} 个采集记录的 collectorType`);
    }

    // ── 汇总 ──────────────────────────────────────────────────
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  迁移摘要  [${mode}]`);
    console.log("─".repeat(50));

    const summaryLines: Array<[string, number]> = [
      ["Source.provider 更新", stats.sourceProviderUpdated],
      ["Source werss-external 软删除", stats.sourceSoftDeleted],
      ["Source.baseUrl 更新", stats.sourceBaseUrlUpdated],
      ["ContentItem.discoveryChannel 更新", stats.contentItemChannelUpdated],
      ["AsyncTask.type 更新", stats.asyncTaskTypeUpdated],
      ["UserIntegration.provider 更新", stats.userIntegrationUpdated],
      ["UserIntegration 冲突合并删除", stats.userIntegrationMerged],
      ["CollectorRun.collectorType 更新", stats.collectorRunTypeUpdated],
      ["错误", stats.errors],
    ];

    for (const [label, count] of summaryLines) {
      const icon = label === "错误" ? (count > 0 ? "❌" : "✅") : "📊";
      console.log(`  ${icon} ${label}: ${count}`);
    }

    // 提示 blocked 文章
    const blockedArticles = await prisma.contentItem.count({
      where: {
        qualityStatus: "blocked",
        discoveryChannel: "wechat-api",
      },
    });

    if (blockedArticles > 0) {
      console.log(`\n  ⚠️  发现 ${blockedArticles} 篇被封禁的微信文章，迁移后仍需在 we-mp-rss 侧刷新内容`);
      console.log("     可使用 we-mp-rss 的 POST /api/articles/{id}/refresh 接口逐篇刷新");
    }

    console.log(`\n${"═".repeat(70)}`);

    if (!isApply) {
      console.log(
        "\n⚠️  这是 dry-run 模式。确认无误后，使用 --apply 参数执行迁移："
      );
      console.log("   npx tsx scripts/migrate-wewe-to-we-mp-rss.ts --apply\n");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("迁移脚本执行失败:", err);
  process.exit(1);
});
