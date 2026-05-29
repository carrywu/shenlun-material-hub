import { NextRequest, NextResponse } from "next/server";
import { getSyncRecords } from "@/services/ima-sync";

// GET /api/sync-records - 同步历史查询（支持筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") ?? undefined;
    const documentRole = searchParams.get("documentRole") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

    const result = await getSyncRecords({ status, documentRole, dateFrom, dateTo, page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Query sync records failed:", error);
    return NextResponse.json(
      { error: "查询同步记录失败" },
      { status: 500 }
    );
  }
}
