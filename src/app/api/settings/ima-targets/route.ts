import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";

// GET /api/settings/ima-targets — 获取当前用户的 IMA 目标列表
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

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
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name, baseUrl, clientId, apiKey, knowledgeBaseId } = body;

    if (!name || !baseUrl || !clientId || !apiKey || !knowledgeBaseId) {
      return NextResponse.json(
        { error: "请填写所有必填字段：名称、Base URL、Client ID、API Key、知识库 ID" },
        { status: 400 }
      );
    }

    const target = await db.imaTarget.create({
      data: {
        userId: user.id,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        clientId: clientId.trim(),
        encryptedApiKey: encrypt(apiKey.trim()),
        knowledgeBaseId: knowledgeBaseId.trim(),
      },
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
