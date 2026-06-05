import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/integrations/wewe-rss/preview-sync — 预览同步结果（不写入）
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
    const baseUrl = body.baseUrl ?? process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
    const dbPath = body.dbPath;
    const syncMode = body.syncMode ?? "auto";
    const { listFeedsAuto, buildFeedUrl } = await import("@/services/integrations/wewe-rss");

    // 获取 WeWe RSS 订阅列表
    const { feeds, source, message } = await listFeedsAuto(baseUrl, syncMode, dbPath);

    // 获取现有的 wewe-rss 来源
    const existingSources = await db.source.findMany({
      where: { provider: "wewe-rss", archivedAt: null },
      select: { id: true, feedId: true, name: true, baseUrl: true, isEnabled: true },
    });

    const existingByFeedId = new Map(existingSources.map((s) => [s.feedId, s]));
    const feedIdSet = new Set(feeds.map((f) => f.id));

    const toCreate: Array<{ feedId: string; name: string; feedUrl: string }> = [];
    const toUpdate: Array<{ feedId: string; name: string; oldName: string }> = [];
    const toDelete: Array<{ feedId: string; name: string; id: string }> = [];
    const manualSourcesIgnored: Array<{ id: string; name: string }> = [];

    // 分类：创建、更新
    for (const feed of feeds) {
      const feedUrl = buildFeedUrl(baseUrl, feed.id);
      const existing = existingByFeedId.get(feed.id);

      if (existing) {
        if (existing.name !== feed.name || existing.baseUrl !== feedUrl) {
          toUpdate.push({ feedId: feed.id, name: feed.name, oldName: existing.name });
        }
      } else {
        toCreate.push({ feedId: feed.id, name: feed.name, feedUrl });
      }
    }

    // 分类：待删除（WeWe 中不存在，但 provider=wewe-rss 的来源存在）
    for (const source of existingSources) {
      if (source.feedId && !feedIdSet.has(source.feedId)) {
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
