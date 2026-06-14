import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt, hasEncryptionKey } from "@/lib/crypto";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

// GET /api/settings/ima-targets — 获取当前用户的 IMA 目标列表
export async function GET(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const targets = await db.imaTarget.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // 隐藏完整 API Key
    const masked = targets.map((t) => {
      let maskedKey = "****";
      try {
        if (t.encryptedApiKey) {
          const decrypted = decrypt(t.encryptedApiKey);
          maskedKey = decrypted.slice(0, 8) + "****";
        }
      } catch {
        // 解密失败
      }
      return {
        id: t.id,
        name: t.name,
        baseUrl: t.baseUrl,
        clientId: t.clientId,
        maskedKey,
        knowledgeBaseId: t.knowledgeBaseId,
        isEnabled: t.isEnabled,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({ data: masked });
  } catch (error) {
    console.error("获取 IMA 目标失败:", error);
    return NextResponse.json({ error: "获取 IMA 目标失败" }, { status: 500 });
  }
}

// POST /api/settings/ima-targets — 创建新的 IMA 目标
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    // 检查加密密钥是否配置
    if (!hasEncryptionKey()) {
      return NextResponse.json(
        { error: "加密密钥未配置（AI_CONFIG_ENCRYPTION_KEY），无法保存 IMA 目标" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { name, baseUrl, clientId, apiKey, knowledgeBaseId } = body;

    // 所有角色只需提供 clientId 和 apiKey，其他字段使用默认值
    if (!clientId || !apiKey) {
      return NextResponse.json(
        { error: "请填写 Client ID 和 API Key" },
        { status: 400 }
      );
    }

    const target = await db.imaTarget.create({
      data: {
        userId: user.id,
        name: (name || "IMA 知识库").trim(),
        baseUrl: (baseUrl || "https://api.ima.qq.com").trim(),
        clientId: clientId.trim(),
        encryptedApiKey: encrypt(apiKey.trim()),
        knowledgeBaseId: (knowledgeBaseId || "default").trim(),
      },
    });

    await auditLog({
      userId: user.id,
      action: "update",
      resource: "AiConfig",
      resourceId: target.id,
      detail: { name: target.name, clientId: target.clientId },
    });

    return NextResponse.json({
      id: target.id,
      name: target.name,
      baseUrl: target.baseUrl,
      clientId: target.clientId,
      knowledgeBaseId: target.knowledgeBaseId,
      isEnabled: target.isEnabled,
    }, { status: 201 });
  } catch (error) {
    console.error("创建 IMA 目标失败:", error);
    return NextResponse.json({ error: "创建 IMA 目标失败" }, { status: 500 });
  }
}
