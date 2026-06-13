import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";

// GET /api/user-content-state?contentItemId=xxx
// Returns the user's learning state for a specific content item
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const contentItemId = searchParams.get("contentItemId");
    if (!contentItemId) {
      return NextResponse.json({ error: "请提供 contentItemId" }, { status: 400 });
    }
    const state = await db.userContentState.findUnique({
      where: { userId_contentItemId: { userId: user.id, contentItemId } },
    });
    return NextResponse.json({
      read: state?.read ?? false,
      ignored: state?.ignored ?? false,
    });
  } catch (error) {
    console.error("Failed to get user content state:", error);
    return NextResponse.json({ error: "获取学习状态失败" }, { status: 500 });
  }
}

// POST /api/user-content-state
// Body: { contentItemId: string, read?: boolean, ignored?: boolean }
// Upserts the user's learning state for a content item
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { contentItemId, read, ignored } = body;
    if (!contentItemId) {
      return NextResponse.json({ error: "请提供 contentItemId" }, { status: 400 });
    }
    // Verify content item exists
    const item = await db.contentItem.findUnique({ where: { id: contentItemId } });
    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }
    const state = await db.userContentState.upsert({
      where: { userId_contentItemId: { userId: user.id, contentItemId } },
      create: {
        userId: user.id,
        contentItemId,
        read: read ?? false,
        ignored: ignored ?? false,
      },
      update: {
        ...(read !== undefined ? { read } : {}),
        ...(ignored !== undefined ? { ignored } : {}),
      },
    });
    return NextResponse.json(state);
  } catch (error) {
    console.error("Failed to update user content state:", error);
    return NextResponse.json({ error: "更新学习状态失败" }, { status: 500 });
  }
}
