import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { resetAiConfigCache } from "@/services/ai";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";

// GET /api/settings/ai-config — 获取当前用户的 AI 配置
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const config = await db.aiConfig.findFirst({
      where: { userId: user.id },
    });

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    // 返回时隐藏完整 key
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
    });
  } catch (error) {
    console.error("获取用户 AI 配置失败:", error);
    return NextResponse.json({ error: "获取配置失败" }, { status: 500 });
  }
}

// POST /api/settings/ai-config — 创建或更新当前用户的 AI 配置
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { baseUrl, apiKey, model, temperature } = body;

    let encryptedKey: string | undefined;
    const trimmedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    if (trimmedApiKey) {
      encryptedKey = encrypt(trimmedApiKey);
    }

    const existing = await db.aiConfig.findFirst({ where: { userId: user.id } });

    if (existing) {
      await db.aiConfig.update({
        where: { id: existing.id },
        data: {
          baseUrl: typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : "https://api.openai.com/v1",
          ...(encryptedKey ? { encryptedKey } : {}),
          model: typeof model === "string" && model.trim() ? model.trim() : "gpt-4o",
          temperature: temperature ?? 0.3,
        },
      });
    } else {
      if (!trimmedApiKey) {
        return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
      }
      await db.aiConfig.create({
        data: {
          name: `user-${user.id}`,
          userId: user.id,
          baseUrl: typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : "https://api.openai.com/v1",
          encryptedKey: encrypt(trimmedApiKey),
          model: typeof model === "string" && model.trim() ? model.trim() : "gpt-4o",
          temperature: temperature ?? 0.3,
        },
      });
    }

    // 清除该用户的缓存
    resetAiConfigCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("保存用户 AI 配置失败:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}

// DELETE /api/settings/ai-config — 删除当前用户的 AI 配置
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    await db.aiConfig.deleteMany({ where: { userId: user.id } });
    resetAiConfigCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除用户 AI 配置失败:", error);
    return NextResponse.json({ error: "删除配置失败" }, { status: 500 });
  }
}
