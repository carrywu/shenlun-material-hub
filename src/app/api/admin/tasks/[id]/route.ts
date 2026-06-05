import { NextResponse } from "next/server";
import { getAsyncTaskById } from "@/lib/async-task";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getAsyncTaskById(id);

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取任务详情失败" },
      { status: 500 }
    );
  }
}
