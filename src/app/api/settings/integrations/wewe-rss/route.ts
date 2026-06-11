import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { checkHealth } from "@/services/integrations/wewe-rss-api";

// GET /api/settings/integrations/wewe-rss — 获取当前用户的 WeWe RSS 配置
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
        provider: "wewe-rss",
      },
    },
  });

  if (!integration) {
    return NextResponse.json({ configured: false });
  }

  const config = integration.config as {
    baseUrl?: string;
    dbPath?: string;
    syncMode?: string;
  };

  return NextResponse.json({
    configured: true,
    id: integration.id,
    isEnabled: integration.isEnabled,
    baseUrl: config.baseUrl ?? "http://localhost:4000",
    dbPath: config.dbPath ?? "",
    syncMode: config.syncMode ?? "auto",
    updatedAt: integration.updatedAt,
  });
}

// POST /api/settings/integrations/wewe-rss — 创建或更新 WeWe RSS 配置
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
    const dbPath = (body.dbPath as string)?.trim() ?? "";
    const syncMode = (body.syncMode as string) ?? "auto";

    if (!baseUrl) {
      return NextResponse.json({ error: "请填写 WeWe RSS 服务地址" }, { status: 400 });
    }

    const config = { baseUrl, dbPath, syncMode };

    const integration = await db.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "wewe-rss",
        },
      },
      create: {
        userId: user.id,
        provider: "wewe-rss",
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
      ...config,
      updatedAt: integration.updatedAt,
    });
  } catch (error) {
    console.error("Failed to save WeWe RSS config:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}

// DELETE /api/settings/integrations/wewe-rss — 删除 WeWe RSS 配置
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    await db.userIntegration.deleteMany({
      where: { userId: user.id, provider: "wewe-rss" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete WeWe RSS config:", error);
    return NextResponse.json({ error: "删除配置失败" }, { status: 500 });
  }
}

// PUT /api/settings/integrations/wewe-rss — 启用/禁用
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
          provider: "wewe-rss",
        },
      },
      data: { isEnabled },
    });

    return NextResponse.json({ success: true, isEnabled: integration.isEnabled });
  } catch (error) {
    console.error("Failed to toggle WeWe RSS config:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
