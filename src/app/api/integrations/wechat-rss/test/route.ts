import { NextRequest, NextResponse } from "next/server";
import { checkHealth, listFeeds } from "@/services/integrations/wechat-rss";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/integrations/wechat-rss/test — 测试 we-mp-rss 连接
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
    const { baseUrl, accessKey, secretKey } = body;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "需要提供 baseUrl" },
        { status: 400 }
      );
    }

    const ak = accessKey || process.env.WE_MP_RSS_ACCESS_KEY || "";
    const sk = secretKey || process.env.WE_MP_RSS_SECRET_KEY || "";

    const health = await checkHealth(baseUrl, ak, sk);
    if (!health.reachable) {
      return NextResponse.json({
        success: false,
        message: health.message,
        authStatus: health.authStatus,
      });
    }

    // 进一步测试：获取订阅列表
    const feedsData = await listFeeds(baseUrl, ak, sk, {});

    return NextResponse.json({
      success: true,
      message: `连接成功，发现 ${feedsData.total} 个公众号`,
      feedCount: feedsData.total,
      feeds: feedsData.list.map((f) => ({ id: f.id, name: f.mpName })),
      authStatus: health.authStatus,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: `连接失败: ${msg}` },
      { status: 500 }
    );
  }
}
