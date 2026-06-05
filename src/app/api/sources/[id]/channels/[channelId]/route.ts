import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// PUT /api/sources/[id]/channels/[channelId] — 更新栏目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { channelId } = await params;
    const body = await request.json();

    const channel = await db.collectionChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "栏目不存在" }, { status: 404 });
    }

    const updated = await db.collectionChannel.update({
      where: { id: channelId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.listUrl !== undefined && { listUrl: body.listUrl }),
        ...(body.urlPattern !== undefined && { urlPattern: body.urlPattern || null }),
        ...(body.paginationPattern !== undefined && { paginationPattern: body.paginationPattern || null }),
        ...(body.maxPages !== undefined && { maxPages: body.maxPages }),
        ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("更新栏目失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/sources/[id]/channels/[channelId] — 删除栏目
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const user = await requireAdmin(_request);
  if (!user) {
    const cookieHeader = _request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { channelId } = await params;

    const channel = await db.collectionChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "栏目不存在" }, { status: 404 });
    }

    await db.collectionChannel.delete({ where: { id: channelId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除栏目失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
