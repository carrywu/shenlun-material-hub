import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(_req: NextRequest) {
  try {
    const response = NextResponse.json({ success: true, message: "注销成功" });
    const isProd = process.env.NODE_ENV === "production";
    
    // Clear the auth_token cookie
    response.headers.append(
      "Set-Cookie",
      `auth_token=; Path=/; HttpOnly; ${isProd ? "Secure;" : ""} SameSite=Strict; Max-Age=0`
    );

    await logger.info("Admin user logged out.", "AUTH");
    return response;
  } catch (_error) {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
