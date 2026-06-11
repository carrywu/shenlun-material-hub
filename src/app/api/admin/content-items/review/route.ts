import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

type ReviewAction = "approve" | "reject";

interface ReviewBody {
  ids: string[];
  action: ReviewAction;
  note?: string;
  force?: boolean;
}

// POST /api/admin/content-items/review — 批量审核
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as ReviewBody;
    const { ids, action, note, force } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action 非法" }, { status: 400 });
    }
    // force-approve 必须填 note
    if (action === "approve" && force && !note?.trim()) {
      return NextResponse.json({ error: "强制通过必须填写理由" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const items = await tx.contentItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, aiDecision: true, adminReviewStatus: true },
      });

      if (action === "approve") {
        if (!force) {
          const notAcceptable = items.filter((i) => i.aiDecision !== "accept");
          if (notAcceptable.length > 0) {
            throw new Error("REQUIRE_AI_ACCEPT");
          }
        }
        await tx.contentItem.updateMany({
          where: { id: { in: ids } },
          data: {
            adminReviewStatus: "approved",
            adminReviewedAt: new Date(),
            adminReviewedBy: user.id,
            adminReviewNote: note ?? null,
            publicVisibleAt: new Date(),
            visibility: "public",
          },
        });
        return { reviewed: ids.length, action, force: !!force };
      }

      // reject：下架 → 删全部素材卡 + 清今日推荐
      await tx.materialCard.deleteMany({
        where: { contentItemId: { in: ids } },
      });
      await tx.contentItem.updateMany({
        where: { id: { in: ids } },
        data: {
          adminReviewStatus: "rejected",
          adminReviewedAt: new Date(),
          adminReviewedBy: user.id,
          adminReviewNote: note ?? null,
          featuredToday: false,
          publicVisibleAt: null,
        },
      });
      return { reviewed: ids.length, action, cardsDeleted: true };
    });

    await auditLog({
      userId: user.id,
      action: "review",
      resource: "ContentItem",
      resourceId: ids.join(","),
      detail: { action, note: note?.slice(0, 200), force: !!force },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUIRE_AI_ACCEPT") {
      return NextResponse.json(
        { error: "审批通过要求文章已通过 AI 评估（或使用 force 强制）" },
        { status: 400 }
      );
    }
    console.error("review failed:", error);
    return NextResponse.json({ error: "审核失败" }, { status: 500 });
  }
}
