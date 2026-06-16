import { NextResponse } from "next/server";
import { listFeeds } from "@/services/integrations/wechat-rss";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/collectors/wechat/sources — 列出 we-mp-rss 可用公众号
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
    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";

    const feedsData = await listFeeds(baseUrl, accessKey, secretKey, {});
    const sources = feedsData.list.map((f) => ({
      id: f.id,
      name: f.mpName,
      cover: f.mpCover,
      intro: f.mpIntro,
      status: f.status,
    }));

    return NextResponse.json({ sources });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("we-mp-rss getSources error:", msg);
    return NextResponse.json(
      { error: `获取微信来源失败: ${msg}` },
      { status: 500 }
    );
  }
}
