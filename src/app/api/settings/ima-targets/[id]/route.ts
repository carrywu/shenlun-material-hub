import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

// DELETE /api/settings/ima-targets/[id] — 删除当前用户名下指定的 IMA 目标。
// 仅删除目标配置，不级联删除已产生的 SyncRecord（历史同步记录保留）。
export async function DELETE(
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

    // 防越权：只能删自己的目标。
    const existing = await db.imaTarget.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "未找到该 IMA 目标" }, { status: 404 });
    }

    await db.imaTarget.delete({ where: { id } });

    await auditLog({
      userId: user.id,
      action: "update",
      resource: "AiConfig",
      resourceId: id,
      detail: { deleted: true, name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 IMA 目标失败:", error);
    return NextResponse.json({ error: "删除 IMA 目标失败" }, { status: 500 });
  }
}
