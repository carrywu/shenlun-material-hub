import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listArticles, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { computeArticlePreview } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/collectors/wechat/sync/preview — 预览采集结果（不写库）
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
    const body = await request.json();
    const { sourceId, feedId } = body;

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

    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";
    const mpId = feedId ?? source.feedId;

    // 通过 we-mp-rss API 获取文章列表
    const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
      mpId: mpId ?? undefined,
      limit: SYNC_ARTICLE_LIMIT,
    });

    // 转换为 WechatArticle 并计算预览
    const wechatArticles = articlesData.list.map((a) =>
      fromWeMpRssArticle(a, source.name)
    );

    const previews = await Promise.all(
      wechatArticles.map((article) => computeArticlePreview(article))
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
