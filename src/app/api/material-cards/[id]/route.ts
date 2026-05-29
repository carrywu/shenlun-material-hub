import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/material-cards/[id] - 获取单个素材卡
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const card = await db.materialCard.findUnique({
      where: { id },
      include: {
        article: { select: { id: true, title: true, source: true, url: true, category: true } },
        syncRecords: { orderBy: { syncedAt: "desc" }, take: 5 },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error("Failed to fetch material card:", error);
    return NextResponse.json({ error: "获取素材卡失败" }, { status: 500 });
  }
}

// PUT /api/material-cards/[id] - 更新素材卡
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, category, tags, excerpt, notes, confirmed } = body;

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    const updated = await db.materialCard.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? tags.join(",") : tags }),
        ...(excerpt !== undefined && { excerpt }),
        ...(notes !== undefined && { notes }),
        ...(confirmed !== undefined && { confirmed }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update material card:", error);
    return NextResponse.json({ error: "更新素材卡失败" }, { status: 500 });
  }
}

// DELETE /api/material-cards/[id] - 删除素材卡
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    await db.materialCard.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete material card:", error);
    return NextResponse.json({ error: "删除素材卡失败" }, { status: 500 });
  }
}
