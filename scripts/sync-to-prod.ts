/**
 * 增量数据同步脚本：本地开发库 → 线上生产库
 *
 * 用法：
 *   # 1. 开 SSH 隧道（另一个终端）
 *   ssh -L 15432:localhost:5432 root@47.119.182.210
 *
 *   # 2. dry-run（仅预览，不写入）
 *   REMOTE_DATABASE_URL="postgresql://shenlun:PASSWORD@localhost:15432/shenlun_material_hub" \
 *     npx tsx scripts/sync-to-prod.ts --dry-run
 *
 *   # 3. 实际执行
 *   REMOTE_DATABASE_URL="postgresql://shenlun:PASSWORD@localhost:15432/shenlun_material_hub" \
 *     npx tsx scripts/sync-to-prod.ts --execute
 *
 * 同步策略：增量追加
 *   - 线上已有数据不变，只添加线上缺失的记录
 *   - Source: 按 externalId+platform 或 name+platform 去重
 *   - CollectionChannel: 按 sourceId+listUrl 去重
 *   - ContentItem: 按 originalUrl 去重
 *   - MaterialCard: 按 contentItemId+cardType 去重（ownerUserId=null 公共卡）
 *
 * ID 重映射：
 *   本地和线上相同实体的 ID 不同（cuid 各自生成），
 *   同步时需将本地外键 ID 替换为线上对应 ID。
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─── 配置 ────────────────────────────────────────────────────────────────────

const IS_DRY_RUN = !process.argv.includes("--execute");
const BATCH_SIZE = 50;

const LOCAL_DATABASE_URL: string =
  process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || "";
const REMOTE_DATABASE_URL: string = process.env.REMOTE_DATABASE_URL || "";

if (!LOCAL_DATABASE_URL) {
  console.error("ERROR: LOCAL_DATABASE_URL (or DATABASE_URL) is required");
  process.exit(1);
}
if (!REMOTE_DATABASE_URL) {
  console.error(
    "ERROR: REMOTE_DATABASE_URL is required.\n" +
      "  Open SSH tunnel first: ssh -L 15432:localhost:5432 root@47.119.182.210\n" +
      '  Then set: REMOTE_DATABASE_URL="postgresql://shenlun:PASSWORD@localhost:15432/shenlun_material_hub"'
  );
  process.exit(1);
}

// ─── Prisma 客户端工厂 ─────────────────────────────────────────────────────

function createClient(databaseUrl: string, label: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  console.log(`[sync] ${label} DB client created`);
  return { client, pool };
}

// ─── 类型工具 ──────────────────────────────────────────────────────────────

type SourceRow = {
  id: string;
  name: string;
  externalId: string | null;
  platform: string;
  contentType: string;
  trustLevel: string;
  regionScopes: string;
  baseUrl: string | null;
  profileUrl: string | null;
  priority: string;
  collectionMode: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  keywords: string;
  collectionFrequency: string | null;
  lastCollectedAt: Date | null;
  lastError: string | null;
  archivedAt: Date | null;
  provider: string | null;
  feedId: string | null;
  lastSyncedAt: Date | null;
  hitRate: number;
  filterRate: number;
  effectiveRate: number;
  avgAiScore: number | null;
  sourceGrade: string | null;
  metricsUpdatedAt: Date | null;
};

type ChannelRow = {
  id: string;
  sourceId: string;
  name: string;
  listUrl: string;
  urlPattern: string | null;
  paginationPattern: string | null;
  maxPages: number;
  isEnabled: boolean;
  lastCollectedAt: Date | null;
  collectedCount: number;
};

type ContentItemRow = {
  id: string;
  sourceId: string;
  channelId: string | null;
  externalContentId: string | null;
  platform: string;
  contentType: string;
  trustLevel: string;
  title: string;
  authorOrAccount: string | null;
  originalUrl: string;
  publishedAt: Date | null;
  section: string | null;
  regionScopes: string;
  topicTags: string;
  excerpt: string | null;
  coverUrl: string | null;
  recommendationReason: string | null;
  verificationStatus: string;
  processingStatus: string;
  discoveryChannel: string | null;
  fullTextStored: boolean;
  fullText: string | null;
  rawHtml: string | null;
  contentHash: string | null;
  linkedOriginalId: string | null;
  filterReason: string | null;
  qualityStatus: string;
  effectiveTextLength: number;
  lastCleanedAt: Date | null;
  aiScore: number | null;
  aiDecision: string | null;
  aiReason: string | null;
  aiCategories: string | null;
  aiUsableFor: string | null;
  aiSummary: string | null;
  aiQuotes: string | null;
  aiAssessedAt: Date | null;
  aiAssessmentError: string | null;
  aiAssessmentSource: string | null;
  aiAssessmentModel: string | null;
  aiPromptVersion: string | null;
  aiContentHash: string | null;
  aiLastError: string | null;
  aiLastFailedAt: Date | null;
  contentGenre: string | null;
  aiScoreDetail: string | null;
  aiScoredAt: Date | null;
  bookmarked: boolean;
  read: boolean;
  ignored: boolean;
  ownerUserId: string | null;
  visibility: string;
  adminReviewStatus: string;
  adminReviewedAt: Date | null;
  adminReviewedBy: string | null;
  adminReviewNote: string | null;
  publicVisibleAt: Date | null;
  featuredToday: boolean;
};

type MaterialCardRow = {
  id: string;
  contentItemId: string;
  cardType: string;
  title: string;
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
  verificationNotes: string | null;
  markdownContent: string | null;
  userEditedContent: string | null;
  confirmed: boolean;
  confirmedAt: Date | null;
  archivedAt: Date | null;
  ownerUserId: string | null;
};

// ─── 统计 ──────────────────────────────────────────────────────────────────

interface SyncStats {
  source: { total: number; created: number; skipped: number };
  channel: { total: number; created: number; skipped: number; orphaned: number };
  contentItem: { total: number; created: number; skipped: number; orphaned: number };
  materialCard: { total: number; created: number; skipped: number; orphaned: number };
}

const stats: SyncStats = {
  source: { total: 0, created: 0, skipped: 0 },
  channel: { total: 0, created: 0, skipped: 0, orphaned: 0 },
  contentItem: { total: 0, created: 0, skipped: 0, orphaned: 0 },
  materialCard: { total: 0, created: 0, skipped: 0, orphaned: 0 },
};

// ─── 辅助：解析本地 channelId → 线上 channelId ──────────────────────────

const localChannelToRemote = new Map<string, string | null>();

async function resolveChannelId(
  remote: PrismaClient,
  localChannelId: string,
  local: PrismaClient,
  sourceIdMap: Map<string, string>
): Promise<string | null> {
  if (localChannelToRemote.has(localChannelId)) {
    return localChannelToRemote.get(localChannelId)!;
  }

  // 查本地频道信息
  const localChannel = await local.collectionChannel.findUnique({
    where: { id: localChannelId },
    select: { sourceId: true, listUrl: true },
  });
  if (!localChannel) {
    localChannelToRemote.set(localChannelId, null);
    return null;
  }

  const remoteSourceId = sourceIdMap.get(localChannel.sourceId);
  if (!remoteSourceId || remoteSourceId.startsWith("NEW:")) {
    localChannelToRemote.set(localChannelId, null);
    return null;
  }

  // 查线上是否有对应频道
  const remoteChannel = await remote.collectionChannel.findFirst({
    where: { sourceId: remoteSourceId, listUrl: localChannel.listUrl },
    select: { id: true },
  });

  const result = remoteChannel?.id ?? null;
  localChannelToRemote.set(localChannelId, result);
  return result;
}

// ─── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
  const mode = IS_DRY_RUN ? "DRY-RUN (预览)" : "EXECUTE (实际写入)";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  数据同步：本地 → 线上（增量追加）`);
  console.log(`  模式: ${mode}`);
  console.log(`${"=".repeat(60)}\n`);

  const { client: local, pool: localPool } = createClient(
    LOCAL_DATABASE_URL,
    "本地"
  );
  const { client: remote, pool: remotePool } = createClient(
    REMOTE_DATABASE_URL,
    "线上"
  );

  try {
    // ── Phase 0: 健康检查 ──────────────────────────────────────────────
    console.log("[Phase 0] 连接健康检查...");
    const localCount = await local.source.count();
    const remoteCount = await remote.source.count();
    console.log(`  本地 Source 数: ${localCount}`);
    console.log(`  线上 Source 数: ${remoteCount}`);
    console.log();

    // ── Phase 1: Source 增量 ─────────────────────────────────────────────
    console.log("[Phase 1] Source 增量同步...");
    const sourceIdMap = new Map<string, string>(); // localId → remoteId

    // 加载线上所有 Source 建立去重索引
    const remoteSources = await remote.source.findMany({
      select: { id: true, name: true, externalId: true, platform: true },
    });
    const remoteSourceByExtKey = new Map<string, string>(); // "extId|platform" → remoteId
    const remoteSourceByNameKey = new Map<string, string>(); // "name|platform" → remoteId
    for (const rs of remoteSources) {
      if (rs.externalId) {
        remoteSourceByExtKey.set(`${rs.externalId}|${rs.platform}`, rs.id);
      }
      remoteSourceByNameKey.set(`${rs.name}|${rs.platform}`, rs.id);
    }

    const localSources = await local.source.findMany();
    stats.source.total = localSources.length;

    for (const ls of localSources) {
      const extKey = ls.externalId
        ? `${ls.externalId}|${ls.platform}`
        : null;
      const nameKey = `${ls.name}|${ls.platform}`;

      let remoteId: string | undefined;
      if (extKey) {
        remoteId = remoteSourceByExtKey.get(extKey);
      }
      if (!remoteId) {
        remoteId = remoteSourceByNameKey.get(nameKey);
      }

      if (remoteId) {
        // 线上已存在 → 记录映射，跳过
        sourceIdMap.set(ls.id, remoteId);
        stats.source.skipped++;
      } else {
        // 线上不存在 → 插入
        if (!IS_DRY_RUN) {
          const created = await remote.source.create({
            data: {
              name: ls.name,
              externalId: ls.externalId,
              platform: ls.platform,
              contentType: ls.contentType,
              trustLevel: ls.trustLevel,
              regionScopes: ls.regionScopes,
              baseUrl: ls.baseUrl,
              profileUrl: ls.profileUrl,
              priority: ls.priority,
              collectionMode: ls.collectionMode,
              isEnabled: ls.isEnabled,
              verificationStatus: ls.verificationStatus,
              keywords: ls.keywords,
              collectionFrequency: ls.collectionFrequency,
              provider: ls.provider,
              feedId: ls.feedId,
              hitRate: ls.hitRate,
              filterRate: ls.filterRate,
              effectiveRate: ls.effectiveRate,
              avgAiScore: ls.avgAiScore,
              sourceGrade: ls.sourceGrade,
            },
          });
          sourceIdMap.set(ls.id, created.id);
        } else {
          // dry-run: 用占位 ID
          sourceIdMap.set(ls.id, `NEW:${ls.name}`);
        }
        stats.source.created++;
        console.log(
          `  + Source: ${ls.name} [${ls.platform}]` +
            (ls.externalId ? ` extId=${ls.externalId}` : "")
        );
      }
    }
    console.log(
      `  Source: ${stats.source.total} 总, ${stats.source.created} 新增, ${stats.source.skipped} 跳过\n`
    );

    // ── Phase 2: CollectionChannel 增量 ──────────────────────────────────
    console.log("[Phase 2] CollectionChannel 增量同步...");
    const localChannels = await local.collectionChannel.findMany();
    stats.channel.total = localChannels.length;

    // 加载线上所有 Channel 建立去重索引
    const remoteChannels = await remote.collectionChannel.findMany({
      select: { id: true, sourceId: true, listUrl: true },
    });
    const remoteChannelKeySet = new Set<string>(); // "sourceId|listUrl"
    for (const rc of remoteChannels) {
      remoteChannelKeySet.add(`${rc.sourceId}|${rc.listUrl}`);
    }

    for (const lc of localChannels) {
      const remoteSourceId = sourceIdMap.get(lc.sourceId);
      if (!remoteSourceId) {
        // 本地 Source 没映射上（不应该发生，但防御）
        stats.channel.orphaned++;
        console.log(
          `  ⚠ Channel 孤立（sourceId=${lc.sourceId} 无映射）: ${lc.name}`
        );
        continue;
      }

      const key = `${remoteSourceId}|${lc.listUrl}`;
      if (remoteChannelKeySet.has(key)) {
        stats.channel.skipped++;
        continue;
      }

      if (!IS_DRY_RUN) {
        await remote.collectionChannel.create({
          data: {
            sourceId: remoteSourceId.startsWith("NEW:")
              ? "" // dry-run 占位 ID，此处不会执行
              : remoteSourceId,
            name: lc.name,
            listUrl: lc.listUrl,
            urlPattern: lc.urlPattern,
            paginationPattern: lc.paginationPattern,
            maxPages: lc.maxPages,
            isEnabled: lc.isEnabled,
            lastCollectedAt: lc.lastCollectedAt,
            collectedCount: lc.collectedCount,
          },
        });
        remoteChannelKeySet.add(key);
      }
      stats.channel.created++;
      console.log(`  + Channel: ${lc.name} → sourceId=${remoteSourceId}`);
    }
    console.log(
      `  Channel: ${stats.channel.total} 总, ${stats.channel.created} 新增, ${stats.channel.skipped} 跳过, ${stats.channel.orphaned} 孤立\n`
    );

    // ── Phase 3: ContentItem 增量 ───────────────────────────────────────
    console.log("[Phase 3] ContentItem 增量同步...");
    const contentItemIdMap = new Map<string, string>(); // localId → remoteId

    // 加载线上所有 ContentItem 的 originalUrl 和 id
    const remoteItems = await remote.contentItem.findMany({
      select: { id: true, originalUrl: true },
    });
    const remoteItemByUrl = new Map<string, string>(); // originalUrl → remoteId
    for (const ri of remoteItems) {
      remoteItemByUrl.set(ri.originalUrl, ri.id);
    }

    const localItems = await local.contentItem.findMany();
    stats.contentItem.total = localItems.length;

    for (const li of localItems) {
      // 查线上是否已有
      const existingRemoteId = remoteItemByUrl.get(li.originalUrl);
      if (existingRemoteId) {
        contentItemIdMap.set(li.id, existingRemoteId);
        stats.contentItem.skipped++;
        continue;
      }

      // 查本地 sourceId 映射
      const remoteSourceId = sourceIdMap.get(li.sourceId);
      if (!remoteSourceId || remoteSourceId.startsWith("NEW:")) {
        stats.contentItem.orphaned++;
        continue;
      }

      // 查本地 channelId 是否也有对应的线上映射
      // CollectionChannel 同步已在前置阶段完成，但若本地 channelId 没有线上对应，设为 null
      const remoteChannelId = li.channelId
        ? await resolveChannelId(remote, li.channelId, local, sourceIdMap)
        : null;

      if (!IS_DRY_RUN) {
        const created = await remote.contentItem.create({
          data: {
            sourceId: remoteSourceId,
            channelId: remoteChannelId,
            externalContentId: li.externalContentId,
            platform: li.platform,
            contentType: li.contentType,
            trustLevel: li.trustLevel,
            title: li.title,
            authorOrAccount: li.authorOrAccount,
            originalUrl: li.originalUrl,
            publishedAt: li.publishedAt,
            section: li.section,
            regionScopes: li.regionScopes,
            topicTags: li.topicTags,
            excerpt: li.excerpt,
            coverUrl: li.coverUrl,
            recommendationReason: li.recommendationReason,
            verificationStatus: li.verificationStatus,
            processingStatus: li.processingStatus,
            discoveryChannel: li.discoveryChannel,
            fullTextStored: li.fullTextStored,
            fullText: li.fullText,
            rawHtml: li.rawHtml,
            contentHash: li.contentHash,
            filterReason: li.filterReason,
            qualityStatus: li.qualityStatus,
            effectiveTextLength: li.effectiveTextLength,
            lastCleanedAt: li.lastCleanedAt,
            aiScore: li.aiScore,
            aiDecision: li.aiDecision,
            aiReason: li.aiReason,
            aiCategories: li.aiCategories,
            aiUsableFor: li.aiUsableFor,
            aiSummary: li.aiSummary,
            aiQuotes: li.aiQuotes,
            aiAssessedAt: li.aiAssessedAt,
            aiAssessmentError: li.aiAssessmentError,
            aiAssessmentSource: li.aiAssessmentSource,
            aiAssessmentModel: li.aiAssessmentModel,
            aiPromptVersion: li.aiPromptVersion,
            aiContentHash: li.aiContentHash,
            aiLastError: li.aiLastError,
            aiLastFailedAt: li.aiLastFailedAt,
            contentGenre: li.contentGenre,
            // ownerUserId 设为 null（公共数据）
            ownerUserId: null,
            visibility: "public",
            adminReviewStatus: li.adminReviewStatus,
            publicVisibleAt: li.publicVisibleAt,
            featuredToday: li.featuredToday,
          },
        });
        contentItemIdMap.set(li.id, created.id);
        remoteItemByUrl.set(li.originalUrl, created.id);
      } else {
        contentItemIdMap.set(li.id, `NEW:${li.originalUrl.slice(0, 50)}`);
      }
      stats.contentItem.created++;
      if (stats.contentItem.created <= 20 || stats.contentItem.created % 50 === 0) {
        console.log(
          `  + ContentItem: ${li.title.slice(0, 60)} [${li.platform}]`
        );
      }
    }
    console.log(
      `  ContentItem: ${stats.contentItem.total} 总, ${stats.contentItem.created} 新增, ${stats.contentItem.skipped} 跳过, ${stats.contentItem.orphaned} 孤立\n`
    );

    // ── Phase 4: MaterialCard 增量 ──────────────────────────────────────
    console.log("[Phase 4] MaterialCard 增量同步...");

    // 加载线上所有 MaterialCard（仅需 contentItemId + cardType + ownerUserId 去重）
    const remoteCards = await remote.materialCard.findMany({
      select: { id: true, contentItemId: true, cardType: true, ownerUserId: true },
    });
    const remoteCardKeySet = new Set<string>(); // "contentItemId|cardType|ownerUserId"
    for (const rc of remoteCards) {
      remoteCardKeySet.add(
        `${rc.contentItemId}|${rc.cardType}|${rc.ownerUserId ?? "null"}`
      );
    }

    const localCards = await local.materialCard.findMany();
    stats.materialCard.total = localCards.length;

    for (const lmc of localCards) {
      const remoteContentItemId = contentItemIdMap.get(lmc.contentItemId);
      if (!remoteContentItemId || remoteContentItemId.startsWith("NEW:")) {
        stats.materialCard.orphaned++;
        continue;
      }

      // 公共卡去重键: contentItemId|cardType|null
      const dedupeKey = `${remoteContentItemId}|${lmc.cardType}|null`;
      if (remoteCardKeySet.has(dedupeKey)) {
        stats.materialCard.skipped++;
        continue;
      }

      if (!IS_DRY_RUN) {
        await remote.materialCard.create({
          data: {
            contentItemId: remoteContentItemId,
            cardType: lmc.cardType,
            title: lmc.title,
            sourceSnapshot: lmc.sourceSnapshot,
            originalFacts: lmc.originalFacts,
            aiSummary: lmc.aiSummary,
            highlightSuggestions: lmc.highlightSuggestions,
            transferSuggestions: lmc.transferSuggestions,
            verificationNotes: lmc.verificationNotes,
            markdownContent: lmc.markdownContent,
            userEditedContent: lmc.userEditedContent,
            confirmed: lmc.confirmed,
            confirmedAt: lmc.confirmedAt,
            // ownerUserId 设为 null（公共数据）
            ownerUserId: null,
          },
        });
        remoteCardKeySet.add(dedupeKey);
      }
      stats.materialCard.created++;
      if (stats.materialCard.created <= 20 || stats.materialCard.created % 50 === 0) {
        console.log(
          `  + MaterialCard: ${lmc.title.slice(0, 50)} [${lmc.cardType}]`
        );
      }
    }
    console.log(
      `  MaterialCard: ${stats.materialCard.total} 总, ${stats.materialCard.created} 新增, ${stats.materialCard.skipped} 跳过, ${stats.materialCard.orphaned} 孤立\n`
    );

    // ── 汇总 ───────────────────────────────────────────────────────────
    console.log(`${"=".repeat(60)}`);
    console.log(`  同步${IS_DRY_RUN ? "预览" : "结果"}汇总`);
    console.log(`${"=".repeat(60)}`);
    console.log(
      `  Source:          ${stats.source.total} 本地 → ${stats.source.created} 新增, ${stats.source.skipped} 跳过`
    );
    console.log(
      `  Channel:         ${stats.channel.total} 本地 → ${stats.channel.created} 新增, ${stats.channel.skipped} 跳过, ${stats.channel.orphaned} 孤立`
    );
    console.log(
      `  ContentItem:     ${stats.contentItem.total} 本地 → ${stats.contentItem.created} 新增, ${stats.contentItem.skipped} 跳过, ${stats.contentItem.orphaned} 孤立`
    );
    console.log(
      `  MaterialCard:    ${stats.materialCard.total} 本地 → ${stats.materialCard.created} 新增, ${stats.materialCard.skipped} 跳过, ${stats.materialCard.orphaned} 孤立`
    );
    console.log();

    if (IS_DRY_RUN) {
      console.log("  ℹ️  这是 dry-run，未写入任何数据。");
      console.log("  使用 --execute 参数实际执行同步。");
    } else {
      console.log("  ✅ 同步完成。");

      // 验证线上数据
      console.log("\n[验证] 线上数据统计:");
      const postSyncCounts = {
        sources: await remote.source.count(),
        channels: await remote.collectionChannel.count(),
        contentItems: await remote.contentItem.count(),
        materialCards: await remote.materialCard.count(),
      };
      console.log(`  Source:          ${postSyncCounts.sources}`);
      console.log(`  Channel:         ${postSyncCounts.channels}`);
      console.log(`  ContentItem:     ${postSyncCounts.contentItems}`);
      console.log(`  MaterialCard:    ${postSyncCounts.materialCards}`);
    }
  } finally {
    await local.$disconnect();
    await remote.$disconnect();
    await localPool.end();
    await remotePool.end();
  }
}

main().catch((e) => {
  console.error("同步脚本执行失败:", e);
  process.exit(1);
});
