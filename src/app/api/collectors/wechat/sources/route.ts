import { NextResponse } from "next/server";
import { WeRssClient } from "@/services/collectors/wechat/weRssClient";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/collectors/wechat/sources — 列出 WeRSS 可用来源
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
    const client = new WeRssClient();
    const sources = await client.getSources();
    return NextResponse.json({ sources });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeRSS getSources error:", msg);
    return NextResponse.json(
      { error: `获取 WeRSS 来源失败: ${msg}` },
      { status: 500 }
    );
  }
}
