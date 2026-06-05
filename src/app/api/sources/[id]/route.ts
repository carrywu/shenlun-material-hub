import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/sources/[id] - 获取单个来源
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(_request);
  if (!user) {
    const cookieHeader = _request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;
    const source = await db.source.findUnique({
      where: { id },
      include: {
        _count: { select: { contentItems: true } },
        collectorRuns: { orderBy: { startedAt: "desc" }, take: 5 },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error("Failed to fetch source:", error);
    return NextResponse.json({ error: "获取来源失败" }, { status: 500 });
  }
}

// PUT /api/sources/[id] - 更新来源
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      externalId,
      platform,
      contentType,
      trustLevel,
      regionScopes,
      baseUrl,
      profileUrl,
      priority,
      collectionMode,
      isEnabled,
      keywords,
      collectionFrequency,
      verificationStatus,
    } = body;

    const existing = await db.source.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    const updated = await db.source.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(externalId !== undefined && { externalId }),
        ...(platform !== undefined && { platform }),
        ...(contentType !== undefined && { contentType }),
        ...(trustLevel !== undefined && { trustLevel }),
        ...(regionScopes !== undefined && {
          regionScopes: JSON.stringify(regionScopes),
        }),
        ...(baseUrl !== undefined && { baseUrl }),
        ...(profileUrl !== undefined && { profileUrl }),
        ...(priority !== undefined && { priority }),
        ...(collectionMode !== undefined && { collectionMode }),
        ...(isEnabled !== undefined && { isEnabled }),
        ...(keywords !== undefined && {
          keywords: JSON.stringify(keywords),
        }),
        ...(collectionFrequency !== undefined && { collectionFrequency }),
        ...(verificationStatus !== undefined && { verificationStatus }),
      },
      include: {
        _count: { select: { contentItems: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update source:", error);
    return NextResponse.json({ error: "更新来源失败" }, { status: 500 });
  }
}

// DELETE /api/sources/[id] - 软删除（设 archivedAt）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(_request);
  if (!user) {
    const cookieHeader = _request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;

    const existing = await db.source.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    await db.source.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to archive source:", error);
    return NextResponse.json({ error: "归档来源失败" }, { status: 500 });
  }
}
