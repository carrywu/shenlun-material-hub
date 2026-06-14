import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testAiConfig } from "@/services/ai";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/ai-config/test — 测试 AI 连接
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const userConfig = await db.aiConfig.findFirst({
      where: { userId: user.id, isEnabled: true },
    });

    if (!userConfig) {
      return NextResponse.json(
        { success: false, error: "请先保存并启用您的个人 AI 配置后再测试连接" },
        { status: 400 }
      );
    }

    const result = await testAiConfig(user.id);

    await db.aiConfig.update({
      where: { id: userConfig.id },
      data: {
        lastTestedAt: new Date(),
        lastTestError: result.success ? null : (result.error ?? "测试失败"),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "测试失败";
    return NextResponse.json({ success: false, error: errorMsg });
  }
}
