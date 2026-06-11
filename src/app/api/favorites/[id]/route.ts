import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// DELETE /api/favorites/[id] — [id] 是 contentItemId；移除收藏 + 删该用户基于该文章的素材卡
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { id: contentItemId } = await params;
    await db.$transaction(async (tx) => {
      await tx.articleFavorite.deleteMany({
        where: { userId: user.id, contentItemId },
      });
      // 连带删该用户基于该文章的素材卡（公共卡和别人卡不动）
      await tx.materialCard.deleteMany({
        where: { ownerUserId: user.id, contentItemId },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("favorites DELETE failed:", error);
    return NextResponse.json({ error: "移除失败" }, { status: 500 });
  }
}
