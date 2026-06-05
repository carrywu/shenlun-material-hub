import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectBilibili } from "@/services/collectors/mediacrawler/bilibili";
import { collectXiaohongshu } from "@/services/collectors/mediacrawler/xiaohongshu";
import { testConnection } from "@/services/collectors/mediacrawler/client";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

/**
 * POST /api/collectors/mediacrawler/crawl
 *
 * Trigger a MediaCrawler crawl for B站 or 小红书.
 *
 * Body:
 *   { platform: "bilibili" | "xiaohongshu", userId: string }
 *
 * Returns the CollectorRun record.
 */
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
    const { platform, userId } = body as {
      platform?: string;
      userId?: string;
    };

    if (!platform || !["bilibili", "xiaohongshu"].includes(platform)) {
      return NextResponse.json(
        { error: "platform 必须为 bilibili 或 xiaohongshu" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "需要提供 userId" },
        { status: 400 }
      );
    }

    // Check MediaCrawler connectivity
    const connected = await testConnection();
    if (!connected) {
      return NextResponse.json(
        {
          error:
            "无法连接 MediaCrawler 服务，请确认服务已在运行（默认端口 8002）",
        },
        { status: 503 }
      );
    }

    // Find the Source for this platform + user
    const source = await db.source.findFirst({
      where: {
        platform,
        externalId: userId,
      },
    });

    if (!source) {
      return NextResponse.json(
        {
          error: `未找到 platform=${platform}、externalId=${userId} 的来源记录，请先在来源管理中添加`,
        },
        { status: 404 }
      );
    }

    if (!source.isEnabled) {
      return NextResponse.json(
        { error: "该来源已禁用" },
        { status: 400 }
      );
    }

    const sourceInfo = {
      id: source.id,
      platform: source.platform,
      contentType: source.contentType,
      trustLevel: source.trustLevel,
    };

    let result;
    if (platform === "bilibili") {
      result = await collectBilibili(sourceInfo, userId);
    } else {
      result = await collectXiaohongshu(sourceInfo, userId);
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      runId: result.runId,
      sourceId: result.sourceId,
      platform,
      discoveredCount: result.discoveredCount,
      importedCount: result.importedCount,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("MediaCrawler crawl error:", error);
    return NextResponse.json(
      { error: "采集执行失败" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collectors/mediacrawler/crawl
 *
 * Check MediaCrawler connectivity status.
 */
export async function GET() {
  const connected = await testConnection();
  return NextResponse.json({
    connected,
    baseUrl: process.env.MEDIACRAWLER_BASE_URL ?? "http://127.0.0.1:8002",
  });
}
