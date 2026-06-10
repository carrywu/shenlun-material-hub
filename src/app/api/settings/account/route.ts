import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
  }

  const displayName = (body as { displayName?: unknown }).displayName;
  if (typeof displayName !== "string") {
    return NextResponse.json({ error: "昵称必须为字符串" }, { status: 400 });
  }

  const normalizedDisplayName = displayName.trim();
  if (!normalizedDisplayName) {
    return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });
  }
  if (normalizedDisplayName.length > 30) {
    return NextResponse.json({ error: "昵称不能超过 30 个字符" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { displayName: normalizedDisplayName },
    select: { id: true, username: true, displayName: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
