import { NextRequest, NextResponse } from "next/server";
import { getSyncRecords } from "@/services/ima-sync";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { ownerScopeWhere } from "@/lib/data-isolation";
import { parsePaginationParams } from "@/lib/api-params";

// GET /api/sync-records - 同步历史查询（支持筛选）
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") ?? undefined;
    const documentRole = searchParams.get("documentRole") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const { page, pageSize } = parsePaginationParams(searchParams);

    // Multi-user data isolation: restrict to own sync records
    const ownerFilter = ownerScopeWhere(user, "userId");

    const result = await getSyncRecords({ status, documentRole, dateFrom, dateTo, page, pageSize, extraWhere: ownerFilter });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Query sync records failed:", error);
    return NextResponse.json(
      { error: "查询同步记录失败" },
      { status: 500 }
    );
  }
}
