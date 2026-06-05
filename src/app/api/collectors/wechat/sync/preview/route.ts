import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  WeRssClient,
  fetchStandardRssArticles,
} from "@/services/collectors/wechat/weRssClient";
import { computeArticlePreview } from "@/services/collectors/wechat/weRssNormalizer";
import { refreshFeed } from "@/services/integrations/wewe-rss-api";

// POST /api/collectors/wechat/sync/preview — 预览采集结果（不写库）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, werssSourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "未找到指定来源" }, { status: 404 });
    }

    const targetUrl = werssSourceId ?? source.baseUrl ?? source.externalId;

    let articles;
    if (
      targetUrl &&
      (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))
    ) {
      // WeWe RSS 来源：先刷新 feed 再预览
      if (source.provider === "wewe-rss" && source.feedId) {
        const weweBaseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
        try {
          await refreshFeed(weweBaseUrl, source.feedId);
        } catch (refreshErr) {
          const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
          console.warn(`WeWe RSS refresh failed for ${source.feedId}: ${refreshMsg}`);
        }
      }
      articles = await fetchStandardRssArticles(targetUrl);
    } else {
      const client = new WeRssClient();
      const result = await client.getArticles(werssSourceId ?? source.id);
      articles = result.articles;
    }

    const previews = await Promise.all(
      articles.map((article) => computeArticlePreview(article))
    );

    return NextResponse.json({
      success: true,
      total: previews.length,
      articles: previews,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Preview error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
