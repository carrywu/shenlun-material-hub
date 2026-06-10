import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/user/subscriptions — 获取当前用户的订阅列表
export async function GET(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  const subscriptions = await db.weweSubscription.findMany({
    where: { userId: user.id, status: "active" },
    include: {
      source: {
        select: { id: true, name: true, feedId: true, lastCollectedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = subscriptions.map((sub) => ({
    id: sub.id,
    sourceId: sub.sourceId,
    sourceName: sub.source.name,
    feedId: sub.source.feedId ?? sub.feedId,
    mpName: sub.mpName ?? sub.source.name,
    status: sub.status,
    lastSyncAt: sub.lastSyncAt?.toISOString() ?? null,
    articleCount: sub.articleCount,
    createdAt: sub.createdAt.toISOString(),
  }));

  return NextResponse.json({ subscriptions: result });
}

// POST /api/user/subscriptions — 添加订阅
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  const body = await request.json();
  const { sourceId, feedId, mpName } = body;

  if (!sourceId) {
    return NextResponse.json({ error: "请指定要订阅的公众号" }, { status: 400 });
  }

  // 检查 source 是否存在
  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    return NextResponse.json({ error: "该公众号不存在" }, { status: 404 });
  }

  // 检查是否已订阅
  const existing = await db.weweSubscription.findUnique({
    where: { userId_sourceId: { userId: user.id, sourceId } },
  });

  if (existing) {
    // 如果已存在但 inactive，重新激活
    if (existing.status === "inactive") {
      const updated = await db.weweSubscription.update({
        where: { id: existing.id },
        data: { status: "active" },
      });
      return NextResponse.json({ subscription: updated });
    }
    return NextResponse.json({ error: "已经订阅了该公众号" }, { status: 409 });
  }

  const subscription = await db.weweSubscription.create({
    data: {
      userId: user.id,
      sourceId,
      feedId: feedId ?? source.feedId ?? null,
      mpName: mpName ?? source.name,
      status: "active",
    },
  });

  return NextResponse.json({ subscription }, { status: 201 });
}

// DELETE /api/user/subscriptions — 取消订阅
export async function DELETE(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");

  if (!sourceId) {
    return NextResponse.json({ error: "请指定要取消订阅的公众号" }, { status: 400 });
  }

  const existing = await db.weweSubscription.findUnique({
    where: { userId_sourceId: { userId: user.id, sourceId } },
  });

  if (!existing) {
    return NextResponse.json({ error: "未订阅该公众号" }, { status: 404 });
  }

  // 标记为 inactive 而非删除
  await db.weweSubscription.update({
    where: { id: existing.id },
    data: { status: "inactive" },
  });

  return NextResponse.json({ success: true });
}
