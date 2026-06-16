import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { checkHealth } from "@/services/integrations/wechat-rss";

// POST /api/settings/integrations/wechat-rss/test — 测试 we-mp-rss 连接
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const body = await request.json();
    const baseUrl = (body.baseUrl as string)?.trim();
    const accessKey = (body.accessKey as string)?.trim() ?? "";
    const secretKey = (body.secretKey as string)?.trim() ?? "";

    if (!baseUrl) {
      return NextResponse.json({ error: "请填写服务地址" }, { status: 400 });
    }

    const result = await checkHealth(baseUrl, accessKey, secretKey);

    return NextResponse.json({
      success: result.reachable,
      message: result.message,
      feedCount: result.feedCount,
      authStatus: result.authStatus,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "测试连接失败";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
