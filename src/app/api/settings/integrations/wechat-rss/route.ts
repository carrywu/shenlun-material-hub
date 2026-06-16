import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { checkHealth } from "@/services/integrations/wechat-rss";

// GET /api/settings/integrations/wechat-rss — 获取当前用户的 we-mp-rss 配置
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "we-mp-rss",
      },
    },
  });

  if (!integration) {
    return NextResponse.json({ configured: false });
  }

  const config = integration.config as {
    baseUrl?: string;
    accessKey?: string;
    secretKey?: string;
    dbPath?: string;
    syncMode?: string;
  };

  return NextResponse.json({
    configured: true,
    id: integration.id,
    isEnabled: integration.isEnabled,
    baseUrl: config.baseUrl ?? "",
    accessKey: config.accessKey ?? "",
    // 不返回 secretKey（敏感信息）
    secretKeyConfigured: !!(config.secretKey),
    dbPath: config.dbPath ?? "",
    syncMode: config.syncMode ?? "auto",
    updatedAt: integration.updatedAt,
  });
}

// POST /api/settings/integrations/wechat-rss — 创建或更新 we-mp-rss 配置
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const body = await request.json();
    const baseUrl = (body.baseUrl as string)?.trim();
    const accessKey = (body.accessKey as string)?.trim() ?? "";
    const secretKey = (body.secretKey as string)?.trim() ?? "";
    const dbPath = (body.dbPath as string)?.trim() ?? "";
    const syncMode = (body.syncMode as string) ?? "auto";

    if (!baseUrl) {
      return NextResponse.json({ error: "请填写 we-mp-rss 服务地址" }, { status: 400 });
    }

    // 如果 secretKey 未传，保留已有值
    let finalSecretKey = secretKey;
    if (!secretKey) {
      const existing = await db.userIntegration.findUnique({
        where: {
          userId_provider: {
            userId: user.id,
            provider: "we-mp-rss",
          },
        },
      });
      if (existing) {
        const oldConfig = existing.config as { secretKey?: string };
        finalSecretKey = oldConfig.secretKey ?? "";
      }
    }

    const config = { baseUrl, accessKey, secretKey: finalSecretKey, dbPath, syncMode };

    const integration = await db.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "we-mp-rss",
        },
      },
      create: {
        userId: user.id,
        provider: "we-mp-rss",
        config: JSON.stringify(config),
        isEnabled: true,
      },
      update: {
        config: JSON.stringify(config),
      },
    });

    return NextResponse.json({
      configured: true,
      id: integration.id,
      isEnabled: integration.isEnabled,
      baseUrl,
      accessKey,
      secretKeyConfigured: !!finalSecretKey,
      dbPath,
      syncMode,
      updatedAt: integration.updatedAt,
    });
  } catch (error) {
    console.error("Failed to save we-mp-rss config:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}

// DELETE /api/settings/integrations/wechat-rss — 删除 we-mp-rss 配置
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    await db.userIntegration.deleteMany({
      where: { userId: user.id, provider: "we-mp-rss" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete we-mp-rss config:", error);
    return NextResponse.json({ error: "删除配置失败" }, { status: 500 });
  }
}

// PUT /api/settings/integrations/wechat-rss — 启用/禁用
export async function PUT(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const body = await request.json();
    const isEnabled = body.isEnabled as boolean;

    const integration = await db.userIntegration.update({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "we-mp-rss",
        },
      },
      data: { isEnabled },
    });

    return NextResponse.json({ success: true, isEnabled: integration.isEnabled });
  } catch (error) {
    console.error("Failed to toggle we-mp-rss config:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
