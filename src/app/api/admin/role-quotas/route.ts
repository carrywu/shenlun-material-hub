import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const ALLOWED_ROLES = ["USER", "VERIFIED_USER"];

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  const rows = await db.roleQuota.findMany({ orderBy: { role: "asc" } });
  return NextResponse.json({ data: rows });
}

export async function PUT(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { role, favoriteLimit } = (await request.json()) as {
      role: string;
      favoriteLimit: number;
    };
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "仅可配置 USER / VERIFIED_USER（ADMIN 不限）" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(favoriteLimit) || favoriteLimit < 0) {
      return NextResponse.json({ error: "配额必须为非负整数" }, { status: 400 });
    }
    const updated = await db.roleQuota.upsert({
      where: { role },
      update: { favoriteLimit, updatedBy: user.id },
      create: { role, favoriteLimit, updatedBy: user.id },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("role-quotas PUT failed:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
