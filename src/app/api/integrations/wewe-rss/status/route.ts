import { NextResponse } from "next/server";
import { checkHealth } from "@/services/integrations/wewe-rss-api";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/integrations/wewe-rss/status — 检查 WeWe RSS 连接状态
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const baseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
    const result = await checkHealth(baseUrl);

    return NextResponse.json({
      success: result.reachable,
      baseUrl,
      reachable: result.reachable,
      feedCount: result.feedCount,
      message: result.message,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
