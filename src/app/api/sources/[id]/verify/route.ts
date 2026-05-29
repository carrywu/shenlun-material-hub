import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/sources/[id]/verify - 核验来源
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { verificationStatus, notes } = body;

    if (!verificationStatus) {
      return NextResponse.json(
        { error: "请提供核验状态" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "unverified",
      "verified",
      "disputed",
      "outdated",
      "retracted",
    ];
    if (!validStatuses.includes(verificationStatus)) {
      return NextResponse.json(
        {
          error: `无效的核验状态，可选值：${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const existing = await db.source.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    const updated = await db.source.update({
      where: { id },
      data: {
        verificationStatus,
        // notes 暂存于 lastError 字段（Source 模型无独立 notes 列）
        ...(notes !== undefined && { lastError: notes }),
      },
      include: {
        _count: { select: { contentItems: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to verify source:", error);
    return NextResponse.json({ error: "核验来源失败" }, { status: 500 });
  }
}
