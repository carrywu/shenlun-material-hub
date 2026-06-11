import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { checkHealth } from "@/services/integrations/wewe-rss-api";
import { getWeweRssServerConfig } from "@/services/integrations/wewe-rss-config";

// POST /api/settings/integrations/wewe-rss/test — 测试 WeWe RSS 连接（仅管理员）
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    // 优先使用服务端环境变量配置的内部 URL
    const serverConfig = getWeweRssServerConfig();
    if (serverConfig.configured) {
      const result = await checkHealth(serverConfig.baseUrl);
      return NextResponse.json({
        success: result.reachable,
        message: result.message,
        feedCount: result.feedCount,
      });
    }

    // 兜底：使用前端传入的 URL（管理员手动输入）
    const body = await request.json();
    const baseUrl = (body.baseUrl as string)?.trim();

    if (!baseUrl) {
      return NextResponse.json(
        { success: false, message: "未配置 WeWe RSS 服务地址，请先在环境变量或配置页面设置" },
        { status: 400 },
      );
    }

    const result = await checkHealth(baseUrl);
    return NextResponse.json({
      success: result.reachable,
      message: result.message,
      feedCount: result.feedCount,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "测试连接失败";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
