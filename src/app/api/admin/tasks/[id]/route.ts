import { NextResponse } from "next/server";
import { getAsyncTaskById } from "@/lib/async-task";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function GET(
  request: Request,
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
