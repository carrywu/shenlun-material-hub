import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sources/[id]/channels — 获取来源的栏目列表
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const channels = await db.collectionChannel.findMany({
      where: { sourceId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("获取栏目列表失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// POST /api/sources/[id]/channels — 创建栏目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, listUrl, urlPattern, paginationPattern, maxPages } = body;

    if (!name || !listUrl) {
      return NextResponse.json(
        { error: "栏目名称和列表页 URL 不能为空" },
        { status: 400 }
      );
    }

    // 检查来源是否存在
    const source = await db.source.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    const channel = await db.collectionChannel.create({
      data: {
        sourceId: id,
        name,
        listUrl,
        urlPattern: urlPattern || null,
        paginationPattern: paginationPattern || null,
        maxPages: maxPages ?? 3,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    console.error("创建栏目失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
