import { NextResponse } from "next/server";
import { checkHealth, getContentHealth, AUTH_EXPIRED_RATIO } from "@/services/integrations/wechat-rss";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/integrations/wechat-rss/status — 检查 we-mp-rss 连接状态和各通道可用性
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
    const dbPath = process.env.WE_MP_RSS_DB_PATH;

    // AK-SK 是否已配置
    const akskConfigured = !!(accessKey && secretKey);

    const apiResult = await checkHealth(baseUrl, accessKey, secretKey);

    // Check SQLite fallback availability
    let sqliteAvailable = false;
    let sqliteMessage = "";
    try {
      const { checkSqliteDb } = await import("@/services/integrations/wechat-rss");
      const sqliteResult = await checkSqliteDb(dbPath);
      sqliteAvailable = sqliteResult.exists && sqliteResult.readable;
      sqliteMessage = sqliteResult.message;
    } catch {
      sqliteAvailable = false;
    }

    // Q3: authStatus 降级判断 — 若 content 缺失比例过高，标记授权可能过期
    let authStatus: "valid" | "expired" | "unknown" = apiResult.authStatus;
    let contentHealth = { totalArticles: 0, missingContent: 0, ratio: 0 };
    if (apiResult.reachable && apiResult.feedCount && apiResult.feedCount > 0) {
      try {
        // 取第一个公众号的内容健康度
        const { listFeeds } = await import("@/services/integrations/wechat-rss");
        const feedData = await listFeeds(baseUrl, accessKey, secretKey, { limit: 1 });
        if (feedData.list.length > 0) {
          contentHealth = await getContentHealth(baseUrl, accessKey, secretKey, feedData.list[0].id);
          if (contentHealth.ratio >= AUTH_EXPIRED_RATIO && authStatus === "valid") {
            authStatus = "expired";
          }
        }
      } catch {
        // content health check 失败不影响主状态
      }
    }

    return NextResponse.json({
      success: apiResult.reachable,
      baseUrl,
      reachable: apiResult.reachable,
      feedCount: apiResult.feedCount,
      message: apiResult.message,
      authStatus,
      akskConfigured,
      contentHealth,
      // Diagnostic channels
      channels: {
        api: {
          available: apiResult.reachable,
          feedCount: apiResult.feedCount,
          baseUrl,
        },
        sqlite: {
          available: sqliteAvailable,
          message: sqliteMessage,
        },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
