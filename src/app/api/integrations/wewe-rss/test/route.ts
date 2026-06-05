import { NextRequest, NextResponse } from "next/server";
import { checkHealth, listFeeds } from "@/services/integrations/wewe-rss-api";

// POST /api/integrations/wewe-rss/test — 测试 WeWe RSS 连接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl } = body;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "需要提供 baseUrl" },
        { status: 400 }
      );
    }

    const health = await checkHealth(baseUrl);
    if (!health.reachable) {
      return NextResponse.json({
        success: false,
        message: health.message,
      });
    }

    // 进一步测试：获取订阅列表
    const feeds = await listFeeds(baseUrl);

    return NextResponse.json({
      success: true,
      message: `连接成功，发现 ${feeds.length} 个公众号`,
      feedCount: feeds.length,
      feeds: feeds.map((f) => ({ id: f.id, name: f.name })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: `连接失败: ${msg}` },
      { status: 500 }
    );
  }
}
