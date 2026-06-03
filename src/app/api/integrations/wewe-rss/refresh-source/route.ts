import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshFeed, normalizeBaseUrl } from "@/services/integrations/wewe-rss";
import { fetchStandardRssArticles } from "@/services/collectors/wechat/weRssClient";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";

// POST /api/integrations/wewe-rss/refresh-source — 刷新并采集单个 WeWe RSS 来源
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "未找到来源" }, { status: 404 });
    }

    if (!source.isEnabled) {
      return NextResponse.json({ error: "该来源已禁用" }, { status: 400 });
    }

    if (source.provider !== "wewe-rss" || !source.feedId) {
      return NextResponse.json(
        { error: "该来源不是 WeWe RSS 来源" },
        { status: 400 }
      );
    }

    // 1. 先刷新 WeWe RSS feed
    const weweBaseUrl =
      process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
    try {
      await refreshFeed(weweBaseUrl, source.feedId);
    } catch (refreshErr) {
      const msg =
        refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      console.warn(`WeWe RSS refresh failed for ${source.feedId}: ${msg}`);
      // 刷新失败不阻塞采集，继续用旧数据
    }

    // 2. 采集 RSS
    const feedUrl =
      source.baseUrl ?? buildLocalFeedUrl(weweBaseUrl, source.feedId);
    const articles = await fetchStandardRssArticles(feedUrl);

    // 3. 标准化并入库
    const result = await normalizeWeRssArticles(articles, {
      sourceId: source.id,
      trustLevel: source.trustLevel,
      contentType: source.contentType,
    });

    // 4. 更新 source 状态
    await db.source.update({
      where: { id: source.id },
      data: {
        lastCollectedAt: new Date(),
        lastError: result.errors.length > 0 ? result.errors.join("\n") : null,
      },
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      discoveredCount: result.discovered,
      importedCount: result.imported,
      skippedCount: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeWe RSS refresh-source error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildLocalFeedUrl(baseUrl: string, feedId: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/feeds/${feedId}.rss`;
}
