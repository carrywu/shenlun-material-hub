import { NextRequest, NextResponse } from "next/server";
import { revokeSession, buildClearCookieHeader } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Extract token from cookie and revoke the DB session
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (tokenMatch) {
      await revokeSession(tokenMatch[1]);
    }

    const response = NextResponse.json({ success: true, message: "注销成功" });
    response.headers.append("Set-Cookie", buildClearCookieHeader());

    await logger.info("User logged out.", "AUTH");
    return response;
  } catch (_error) {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
