import { NextRequest, NextResponse } from "next/server";
import { listArticles } from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/collectors/wechat/articles — 获取微信文章（通过 we-mp-rss API）
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const mpId = searchParams.get("mpId") || searchParams.get("sourceId");
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");

    if (!mpId) {
      return NextResponse.json(
        { error: "需要提供 mpId 参数" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";

    const offset = page ? (Number(page) - 1) * (Number(pageSize) || 30) : 0;
    const limit = pageSize ? Number(pageSize) : 30;

    const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
      mpId,
      offset,
      limit,
    });

    const articles = articlesData.list.map((a) =>
      fromWeMpRssArticle(a)
    );

    return NextResponse.json({
      articles,
      total: articlesData.total,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("we-mp-rss getArticles error:", msg);
    return NextResponse.json(
      { error: `获取微信文章失败: ${msg}` },
      { status: 500 }
    );
  }
}
