import { NextRequest, NextResponse } from "next/server";
import { WeRssClient } from "@/services/collectors/wechat/weRssClient";

// GET /api/collectors/wechat/articles — 获取 WeRSS 文章
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId 参数" },
        { status: 400 }
      );
    }

    const client = new WeRssClient();
    const result = await client.getArticles(sourceId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    return NextResponse.json({
      articles: result.articles,
      total: result.total,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeRSS getArticles error:", msg);
    return NextResponse.json(
      { error: `获取 WeRSS 文章失败: ${msg}` },
      { status: 500 }
    );
  }
}
