import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { FEATURED_MP_ID } from "@/services/integrations/wechat-rss";

// POST /api/integrations/wechat-rss/sync-sources — 从 we-mp-rss 同步公众号列表到 Source
// 只创建和更新，不删除。缺失来源返回 toDelete 供前端确认。
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl = body.baseUrl ?? process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = body.accessKey ?? process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = body.secretKey ?? process.env.WE_MP_RSS_SECRET_KEY ?? "";
    const dbPath = body.dbPath ?? process.env.WE_MP_RSS_DB_PATH;
    const syncMode = body.syncMode ?? "auto";
    const { listFeedsAuto } = await import("@/services/integrations/wechat-rss");

    // 1. 从 we-mp-rss 获取订阅列表（API 优先，SQLite 兜底）
    const { feeds, source: syncSource, message: _message } = await listFeedsAuto(baseUrl, accessKey, secretKey, syncMode, dbPath);

    if (feeds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "we-mp-rss 中没有订阅的公众号",
        syncSource,
        created: 0,
        updated: 0,
        skipped: 0,
        toDelete: [],
      });
    }

    // 2. 获取现有的 we-mp-rss 来源
    const existingSources = await db.source.findMany({
      where: { provider: "we-mp-rss", archivedAt: null },
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
      const existing = existingByFeedId.get(feed.id);

      if (existing) {
        if (existing.name !== feed.mpName) {
          await db.source.update({
            where: { id: existing.id },
            data: {
              name: feed.mpName,
              baseUrl,
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
            name: feed.mpName,
            platform: "wechat",
            contentType: "policy_analysis",
            trustLevel: "unverified",
            provider: "we-mp-rss",
            feedId: feed.id,
            baseUrl,
            isEnabled: true,
            lastSyncedAt: new Date(),
          },
        });
        created++;
      }
    }

    // 4. 收集缺失来源（不删除，返回给前端确认）
    // Q15: 排除 FEATURED_MP_ID（精选文章虚拟公众号）
    const toDelete: Array<{ id: string; feedId: string; name: string }> = [];
    for (const source of existingSources) {
      if (source.feedId && !feedIdSet.has(source.feedId) && source.feedId !== FEATURED_MP_ID) {
        toDelete.push({
          id: source.id,
          feedId: source.feedId,
          name: source.name,
        });
      }
    }

    const syncMessage = toDelete.length > 0
      ? `同步完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}。发现 ${toDelete.length} 个来源在 we-mp-rss 中已删除，请确认是否同步删除。`
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
    console.error("we-mp-rss sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
