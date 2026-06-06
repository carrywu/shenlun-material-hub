import { NextResponse } from "next/server";
import { checkHealth } from "@/services/integrations/wewe-rss-api";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/integrations/wewe-rss/status — 检查 WeWe RSS 连接状态和各通道可用性
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
    const apiResult = await checkHealth(baseUrl);

    // Check SQLite fallback availability
    let sqliteAvailable = false;
    let sqliteMessage = "";
    try {
      const { checkSqliteDb } = await import("@/services/integrations/wewe-rss-sqlite");
      const sqliteResult = await checkSqliteDb();
      sqliteAvailable = sqliteResult.exists && sqliteResult.readable;
      sqliteMessage = sqliteResult.message;
    } catch {
      sqliteAvailable = false;
    }

    // Check external WeRSS fallback
    const weressBaseUrl = process.env.WERSS_BASE_URL;
    const weressAvailable = !!weressBaseUrl;

    return NextResponse.json({
      success: apiResult.reachable,
      baseUrl,
      reachable: apiResult.reachable,
      feedCount: apiResult.feedCount,
      message: apiResult.message,
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
        weressFallback: {
          available: weressAvailable,
          baseUrl: weressBaseUrl ?? null,
        },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
