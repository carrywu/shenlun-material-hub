import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/material-cards/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const card = await db.materialCard.findUnique({
      where: { id },
      include: {
        contentItem: {
          select: {
            id: true,
            title: true,
            originalUrl: true,
            contentType: true,
            platform: true,
            fullText: true,
            source: { select: { id: true, name: true, platform: true } },
          },
        },
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

// PUT /api/material-cards/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      cardType,
      sourceSnapshot,
      originalFacts,
      aiSummary,
      highlightSuggestions,
      transferSuggestions,
      verificationNotes,
      markdownContent,
      userEditedContent,
      confirmed,
    } = body;

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    const updated = await db.materialCard.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(cardType !== undefined && { cardType }),
        ...(sourceSnapshot !== undefined && { sourceSnapshot }),
        ...(originalFacts !== undefined && { originalFacts }),
        ...(aiSummary !== undefined && { aiSummary }),
        ...(highlightSuggestions !== undefined && { highlightSuggestions }),
        ...(transferSuggestions !== undefined && { transferSuggestions }),
        ...(verificationNotes !== undefined && { verificationNotes }),
        ...(markdownContent !== undefined && { markdownContent }),
        ...(userEditedContent !== undefined && { userEditedContent }),
        ...(confirmed !== undefined && {
          confirmed,
          ...(confirmed ? { confirmedAt: new Date() } : {}),
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update material card:", error);
    return NextResponse.json({ error: "更新素材卡失败" }, { status: 500 });
  }
}

// DELETE /api/material-cards/[id]
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
