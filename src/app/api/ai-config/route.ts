import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// GET /api/ai-config — 获取 AI 配置
export async function GET() {
  try {
    const config = await db.aiConfig.findFirst({
      where: { name: "default" },
    });

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    // 返回时隐藏完整 key，只显示前 8 位
    let maskedKey = "****";
    try {
      const decrypted = decrypt(config.encryptedKey);
      maskedKey = decrypted.slice(0, 8) + "****";
    } catch {
      // 解密失败，返回 masked
    }

    return NextResponse.json({
      configured: true,
      id: config.id,
      name: config.name,
      baseUrl: config.baseUrl,
      maskedKey,
      model: config.model,
      temperature: config.temperature,
      isEnabled: config.isEnabled,
      lastTestedAt: config.lastTestedAt,
      lastTestError: config.lastTestError,
    });
  } catch (error) {
    console.error("获取 AI 配置失败:", error);
    return NextResponse.json({ error: "获取配置失败" }, { status: 500 });
  }
}

// POST /api/ai-config — 创建或更新 AI 配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey, model, temperature } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }

    const encryptedKey = encrypt(apiKey);

    const existing = await db.aiConfig.findFirst({ where: { name: "default" } });

    if (existing) {
      await db.aiConfig.update({
        where: { id: existing.id },
        data: {
          baseUrl: baseUrl || "https://api.openai.com/v1",
          encryptedKey,
          model: model || "gpt-4o",
          temperature: temperature ?? 0.3,
          lastTestError: null, // 重置测试错误
        },
      });
    } else {
      await db.aiConfig.create({
        data: {
          name: "default",
          baseUrl: baseUrl || "https://api.openai.com/v1",
          encryptedKey,
          model: model || "gpt-4o",
          temperature: temperature ?? 0.3,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("保存 AI 配置失败:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}

// DELETE /api/ai-config — 删除 AI 配置
export async function DELETE() {
  try {
    await db.aiConfig.deleteMany({ where: { name: "default" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 AI 配置失败:", error);
    return NextResponse.json({ error: "删除配置失败" }, { status: 500 });
  }
}
