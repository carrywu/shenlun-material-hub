import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listFeeds, buildFeedUrl } from "@/services/integrations/wewe-rss";

// POST /api/integrations/wewe-rss/sync-sources — 从 WeWe RSS 同步公众号列表到 Source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl = body.baseUrl ?? process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";

    // 1. 从 WeWe RSS 获取订阅列表
    const feeds = await listFeeds(baseUrl);

    if (feeds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "WeWe RSS 中没有订阅的公众号",
        created: 0,
        updated: 0,
        disabled: 0,
        skipped: 0,
      });
    }

    // 2. 获取现有的 wewe-rss 来源
    const existingSources = await db.source.findMany({
      where: {
        provider: "wewe-rss",
        archivedAt: null,
      },
      select: { id: true, feedId: true, name: true, baseUrl: true },
    });

    const existingByFeedId = new Map(
      existingSources.map((s) => [s.feedId, s])
    );

    const feedIdSet = new Set(feeds.map((f) => f.id));
    let created = 0;
    let updated = 0;
    let disabled = 0;
    let skipped = 0;

    // 3. Upsert 每个 feed
    for (const feed of feeds) {
      const feedUrl = buildFeedUrl(baseUrl, feed.id);
      const existing = existingByFeedId.get(feed.id);

      if (existing) {
        // 已有来源：更新 name 和 baseUrl
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
          // 仅更新 lastSyncedAt
          await db.source.update({
            where: { id: existing.id },
            data: { lastSyncedAt: new Date() },
          });
          skipped++;
        }
      } else {
        // 新来源：创建
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

    // 4. 标记 WeWe RSS 中已删除的来源为 disabled
    for (const source of existingSources) {
      if (source.feedId && !feedIdSet.has(source.feedId)) {
        await db.source.update({
          where: { id: source.id },
          data: { isEnabled: false },
        });
        disabled++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}，失效 ${disabled}`,
      created,
      updated,
      disabled,
      skipped,
      total: feeds.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeWe RSS sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
