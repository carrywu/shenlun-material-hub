import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listFeedsAuto, buildFeedUrl } from "@/services/integrations/wewe-rss";

// POST /api/integrations/wewe-rss/sync-sources — 从 WeWe RSS 同步公众号列表到 Source
// 只创建和更新，不删除。缺失来源返回 toDelete 供前端确认。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl = body.baseUrl ?? process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
    const dbPath = body.dbPath;
    const syncMode = body.syncMode ?? "auto";

    // 1. 从 WeWe RSS 获取订阅列表（API 优先，SQLite 兜底）
    const { feeds, source: syncSource, message } = await listFeedsAuto(baseUrl, syncMode, dbPath);

    if (feeds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "WeWe RSS 中没有订阅的公众号",
        syncSource,
        created: 0,
        updated: 0,
        skipped: 0,
        toDelete: [],
      });
    }

    // 2. 获取现有的 wewe-rss 来源
    const existingSources = await db.source.findMany({
      where: { provider: "wewe-rss", archivedAt: null },
      select: { id: true, feedId: true, name: true, baseUrl: true },
    });

    const existingByFeedId = new Map(
      existingSources.map((s) => [s.feedId, s])
    );

    const feedIdSet = new Set(feeds.map((f) => f.id));
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 3. Upsert 每个 feed
    for (const feed of feeds) {
      const feedUrl = buildFeedUrl(baseUrl, feed.id);
      const existing = existingByFeedId.get(feed.id);

      if (existing) {
        if (existing.name !== feed.name || existing.baseUrl !== feedUrl) {
          await db.source.update({
            where: { id: existing.id },
            data: {
              name: feed.name,
              baseUrl: feedUrl,
              lastSyncedAt: new Date(),
            },
          });
          updated++;
        } else {
          await db.source.update({
            where: { id: existing.id },
            data: { lastSyncedAt: new Date() },
          });
          skipped++;
        }
      } else {
        await db.source.create({
          data: {
            name: feed.name,
            platform: "wechat",
            contentType: "policy_analysis",
            trustLevel: "unverified",
            provider: "wewe-rss",
            feedId: feed.id,
            baseUrl: feedUrl,
            isEnabled: true,
            lastSyncedAt: new Date(),
          },
        });
        created++;
      }
    }

    // 4. 收集缺失来源（不删除，返回给前端确认）
    const toDelete: Array<{ id: string; feedId: string; name: string }> = [];
    for (const source of existingSources) {
      if (source.feedId && !feedIdSet.has(source.feedId)) {
        toDelete.push({
          id: source.id,
          feedId: source.feedId,
          name: source.name,
        });
      }
    }

    const syncMessage = toDelete.length > 0
      ? `同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}。发现 ${toDelete.length} 个来源在 WeWe RSS 中已删除，请确认是否同步删除。`
      : `同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}`;

    return NextResponse.json({
      success: true,
      message: syncMessage,
      syncSource,
      created,
      updated,
      skipped,
      toDelete,
      total: feeds.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeWe RSS sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
