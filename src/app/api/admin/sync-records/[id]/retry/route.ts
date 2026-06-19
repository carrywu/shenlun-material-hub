import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { ImaService } from "@/services/ima-sync";
import { auditLog } from "@/lib/audit-logger";

// POST /api/admin/sync-records/[id]/retry — 后台运维代重同步（P1-残留-2）
//
// 背景：个人同步接口 POST /api/sync 已收紧为「只能同步自己的卡」（含 ADMIN）。
// 后台运维需要代用户重同步失败/需重传的卡，故开此显式 admin-only 接口。
//
// 语义：
// - 以「卡的真实 owner」身份代调 service（service 的 owner 校验对真实 owner 放行），
//   新 SyncRecord 归属原用户，不是 ADMIN。
// - 不限状态：任意 status 都可重试（运维可重传已 success 的卡）。
// - 旧记录保留不动（仅新建一条 SyncRecord，审计痕迹完整）。
// - 仅适用素材卡同步记录（materialCardId 非空）；文章正文同步记录无卡可重试 → 400。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const record = await db.syncRecord.findUnique({
      where: { id },
      select: { id: true, materialCardId: true, documentRole: true },
    });
    if (!record) {
      return NextResponse.json({ error: "同步记录不存在" }, { status: 404 });
    }
    if (!record.materialCardId) {
      // 文章正文同步记录（documentRole=original_archive）无卡可重试。
      return NextResponse.json(
        { error: "该记录为文章正文同步，无素材卡可重试" },
        { status: 400 }
      );
    }

    // 取卡的真实 owner，以 owner 身份代调 service（syncRecord 归属原用户）。
    const card = await db.materialCard.findUnique({
      where: { id: record.materialCardId },
      select: { id: true, ownerUserId: true },
    });
    if (!card) {
      return NextResponse.json({ error: "关联素材卡不存在" }, { status: 404 });
    }
    if (!card.ownerUserId) {
      return NextResponse.json(
        { error: "关联素材卡无归属用户，无法代重同步" },
        { status: 400 }
      );
    }

    const result = await ImaService.syncMaterialCard({
      materialCardId: card.id,
      userId: card.ownerUserId,
    });

    await auditLog({
      userId: admin.id,
      action: "sync",
      resource: "MaterialCard",
      resourceId: card.id,
      detail: {
        retriedByAdmin: admin.id,
        originalOwner: card.ownerUserId,
        sourceSyncRecordId: id,
        outcome: result.status,
      },
    });

    return NextResponse.json({
      success: result.status !== "failed",
      status: result.status,
      syncRecordId: result.syncRecordId,
      errorCode: result.errorCode,
      error: result.errorMessage,
    });
  } catch (error) {
    console.error("Admin retry sync failed:", error);
    return NextResponse.json({ error: "重同步失败" }, { status: 500 });
  }
}
