import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { canModifyResource } from "@/lib/data-isolation";

// PATCH /api/annotations/[id] — 更新批注
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    const { comment, color, selectedText } = body;

    const existing = await db.articleAnnotation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "批注不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.userId)) {
      return forbiddenResponse("无权修改该批注");
    }

    const updated = await db.articleAnnotation.update({
      where: { id },
      data: {
        ...(comment !== undefined && { comment }),
        ...(color !== undefined && { color }),
        ...(selectedText !== undefined && { selectedText }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update annotation:", error);
    return NextResponse.json({ error: "更新批注失败" }, { status: 500 });
  }
}

// DELETE /api/annotations/[id] — 删除批注
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { id } = await params;

    const existing = await db.articleAnnotation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "批注不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.userId)) {
      return forbiddenResponse("无权删除该批注");
    }

    await db.articleAnnotation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete annotation:", error);
    return NextResponse.json({ error: "删除批注失败" }, { status: 500 });
  }
}
