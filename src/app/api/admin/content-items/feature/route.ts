import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/admin/content-items/feature — 推送到今日推荐
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });

    const item = await db.contentItem.findUnique({
      where: { id },
      select: { id: true, adminReviewStatus: true },
    });
    if (!item) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (item.adminReviewStatus !== "approved") {
      return NextResponse.json(
        { error: "仅审核通过的文章可推送至今日推荐" },
        { status: 400 }
      );
    }

    await db.contentItem.update({ where: { id }, data: { featuredToday: true } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("feature POST failed:", error);
    return NextResponse.json({ error: "推送失败" }, { status: 500 });
  }
}

// DELETE /api/admin/content-items/feature?id=... — 从今日推荐撤下
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });

    await db.contentItem.update({ where: { id }, data: { featuredToday: false } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("feature DELETE failed:", error);
    return NextResponse.json({ error: "撤下失败" }, { status: 500 });
  }
}
