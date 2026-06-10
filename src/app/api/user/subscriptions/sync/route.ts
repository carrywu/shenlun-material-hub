import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { getWeweRssServerConfig } from "@/services/integrations/wewe-rss-config";
import { listFeeds } from "@/services/integrations/wewe-rss-api";

// POST /api/user/subscriptions/sync — 从 WeWe RSS 同步公众号列表到 Source 表
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  const serverConfig = getWeweRssServerConfig();
  if (!serverConfig.configured) {
    return NextResponse.json(
      { error: "管理员尚未配置 WeWe RSS 服务地址" },
      { status: 503 },
    );
  }

  try {
    const feeds = await listFeeds(serverConfig.baseUrl);

    // 查找已有 wewe-rss sources
    const existingSources = await db.source.findMany({
      where: { provider: "wewe-rss", archivedAt: null },
      select: { id: true, feedId: true, name: true },
    });

    const existingFeedMap = new Map(
      existingSources.filter((s) => s.feedId).map((s) => [s.feedId!, s]),
    );

    let added = 0;
    let updated = 0;

    for (const feed of feeds) {
      const existing = existingFeedMap.get(feed.id);
      if (existing) {
        // 更新名称和同步时间
        await db.source.update({
          where: { id: existing.id },
          data: {
            name: feed.name || existing.name,
            lastSyncedAt: feed.updateTime ? new Date(feed.updateTime * 1000) : new Date(),
          },
        });
        updated++;
      } else {
        // 创建新的 Source
        await db.source.create({
          data: {
            name: feed.name || `公众号-${feed.id}`,
            platform: "wechat",
            contentType: "article",
            trustLevel: "medium",
            priority: "P2",
            provider: "wewe-rss",
            feedId: feed.id,
            baseUrl: serverConfig.baseUrl,
            isEnabled: true,
            verificationStatus: "verified",
            lastSyncedAt: feed.updateTime ? new Date(feed.updateTime * 1000) : new Date(),
          },
        });
        added++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `同步完成：新增 ${added} 个公众号，更新 ${updated} 个`,
      added,
      updated,
      total: feeds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
