import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { ImaService } from "@/services/ima-sync";

// GET /api/ima/health — 管理员检查当前用户 IMA 配置和连接状态
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const result = await ImaService.healthCheck(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("IMA health check failed:", error);
    return NextResponse.json(
      {
        configured: false,
        reachable: false,
        authValid: false,
        lastCheckedAt: new Date().toISOString(),
        errorCode: "IMA_HEALTH_FAILED",
        errorMessage: error instanceof Error ? error.message : "IMA 检查失败",
      },
      { status: 500 }
    );
  }
}
