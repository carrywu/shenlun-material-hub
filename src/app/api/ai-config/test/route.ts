import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testAiConfig } from "@/services/ai";

// POST /api/ai-config/test — 测试 AI 连接
export async function POST() {
  try {
    const result = await testAiConfig();

    // 更新测试结果
    await db.aiConfig.updateMany({
      where: { name: "default" },
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
