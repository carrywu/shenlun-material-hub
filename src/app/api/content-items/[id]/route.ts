import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/content-items/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, platform: true } },
        materialCards: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch content item:", error);
    return NextResponse.json({ error: "获取内容条目失败" }, { status: 500 });
  }
}

// PUT /api/content-items/[id] — 更新处理状态等
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { processingStatus, fullText, excerpt, topicTags, regionScopes } = body;

    const existing = await db.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    const updated = await db.contentItem.update({
      where: { id },
      data: {
        ...(processingStatus !== undefined && { processingStatus }),
        ...(fullText !== undefined && { fullText, fullTextStored: !!fullText }),
        ...(excerpt !== undefined && { excerpt }),
        ...(topicTags !== undefined && { topicTags: JSON.stringify(topicTags) }),
        ...(regionScopes !== undefined && { regionScopes: JSON.stringify(regionScopes) }),
      },
      include: {
        source: { select: { id: true, name: true, platform: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update content item:", error);
    return NextResponse.json({ error: "更新内容条目失败" }, { status: 500 });
  }
}

// DELETE /api/content-items/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    await db.contentItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete content item:", error);
    return NextResponse.json({ error: "删除内容条目失败" }, { status: 500 });
  }
}
