import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, verifyPassword, hashPassword, revokeAllUserSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** POST /api/auth/change-password — change own password */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "请输入当前密码和新密码" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "新密码长度不能少于 6 个字符" }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return unauthorizedResponse();

  const result = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!result.valid) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Revoke all other sessions (keep current one)
  await revokeAllUserSessions(user.id);

  await logger.info(`User "${user.username}" changed their password.`, "AUTH");

  return NextResponse.json({ success: true, message: "密码修改成功" });
}
