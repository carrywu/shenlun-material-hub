import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { FEATURED_MP_ID } from "@/services/integrations/wechat-rss";

// POST /api/integrations/wechat-rss/preview-sync — 预览同步结果（不写入）
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

    // 获取 we-mp-rss 订阅列表
    const { feeds, source, message } = await listFeedsAuto(baseUrl, accessKey, secretKey, syncMode, dbPath);

    // 获取现有的 we-mp-rss 来源
    const existingSources = await db.source.findMany({
      where: { provider: "we-mp-rss", archivedAt: null },
      select: { id: true, feedId: true, name: true, baseUrl: true, isEnabled: true },
    });

    const existingByFeedId = new Map(existingSources.map((s) => [s.feedId, s]));
    const feedIdSet = new Set(feeds.map((f) => f.id));

    const toCreate: Array<{ feedId: string; name: string; baseUrl: string }> = [];
    const toUpdate: Array<{ feedId: string; name: string; oldName: string }> = [];
    const toDelete: Array<{ feedId: string; name: string; id: string }> = [];
    const manualSourcesIgnored: Array<{ id: string; name: string }> = [];

    // 分类：创建、更新
    for (const feed of feeds) {
      const existing = existingByFeedId.get(feed.id);

      if (existing) {
        if (existing.name !== feed.mpName) {
          toUpdate.push({ feedId: feed.id, name: feed.mpName, oldName: existing.name });
        }
      } else {
        toCreate.push({ feedId: feed.id, name: feed.mpName, baseUrl });
      }
    }

    // 分类：待删除（we-mp-rss 中不存在，但 provider=we-mp-rss 的来源存在）
    // Q15: 排除 FEATURED_MP_ID
    for (const source of existingSources) {
      if (source.feedId && !feedIdSet.has(source.feedId) && source.feedId !== FEATURED_MP_ID) {
        toDelete.push({ feedId: source.feedId, name: source.name, id: source.id });
      }
    }

    return NextResponse.json({
      success: true,
      source,
      message,
      toCreate,
      toUpdate,
      toDelete,
      manualSourcesIgnored,
      total: feeds.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Preview sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
