import { NextRequest, NextResponse } from "next/server";
import { revokeSession, buildClearCookieHeader, requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-logger";

export async function POST(req: NextRequest) {
  try {
    // Extract token from cookie and revoke the DB session
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);

    // 尝试获取当前用户 ID 用于审计
    let userId: string | undefined;
    try {
      const user = await requireAuth(req);
      if (user) userId = user.id;
    } catch {
      // session 可能已过期，忽略
    }

    if (tokenMatch) {
      await revokeSession(tokenMatch[1]);
    }

    const response = NextResponse.json({ success: true, message: "注销成功" });
    response.headers.append("Set-Cookie", buildClearCookieHeader());

    await logger.info("User logged out.", "AUTH");

    await auditLog({
      userId,
      action: "logout",
      resource: "Session",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });

    return response;
  } catch (_error) {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
