import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listArticles, getArticle, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
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

    // we-mp-rss LIST 端点返回 ArticleBase（无 content/content_html），
    // 需要对 has_content=1 的文章调用 DETAIL 端点补充完整内容
    const enrichedArticles = await Promise.all(
      articlesData.list.map(async (a) => {
        if (a.hasContent === 1 && !a.content) {
          try {
            const detail = await getArticle(baseUrl, accessKey, secretKey, a.id);
            return { ...a, content: detail.content, contentHtml: detail.contentHtml };
          } catch {
            return a;
          }
        }
        return a;
      })
    );

    // 转换为 WechatArticle 并计算预览
    const wechatArticles = enrichedArticles.map((a) =>
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
