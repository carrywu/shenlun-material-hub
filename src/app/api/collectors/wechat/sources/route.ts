import { NextResponse } from "next/server";
import { WeRssClient } from "@/services/collectors/wechat/weRssClient";

// GET /api/collectors/wechat/sources — 列出 WeRSS 可用来源
export async function GET() {
  try {
    const client = new WeRssClient();
    const sources = await client.listSources();
    return NextResponse.json({ sources });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeRSS listSources error:", msg);
    return NextResponse.json(
      { error: `获取 WeRSS 来源失败: ${msg}` },
      { status: 500 }
    );
  }
}
