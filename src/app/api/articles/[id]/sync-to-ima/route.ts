import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { canAccessResource } from "@/lib/data-isolation";
import { ImaService } from "@/services/ima-sync";
import { auditLog } from "@/lib/audit-logger";

// POST /api/articles/[id]/sync-to-ima — 同步当前文章或其素材卡到 IMA
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const { id } = await params;
    const item = await db.contentItem.findUnique({
      where: { id },
      select: {
        id: true,
        ownerUserId: true,
        visibility: true,
        adminReviewStatus: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }
    if (!canAccessResource(user, item.ownerUserId, item.visibility)) {
      return forbiddenResponse("无权同步该文章");
    }
    if (user.role !== "ADMIN" && item.adminReviewStatus !== "approved") {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    const result = await ImaService.syncArticle({ articleId: id, userId: user.id });

    await auditLog({
      userId: user.id,
      action: "sync",
      resource: "ContentItem",
      resourceId: id,
      detail: { sourceType: result.sourceType, success: result.success },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Article IMA sync failed:", error);
    return NextResponse.json(
      { success: false, sourceType: "article", errorMessage: "同步到 IMA 失败" },
      { status: 500 }
    );
  }
}
