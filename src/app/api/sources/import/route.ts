import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

interface ImportSource {
  name: string;
  platform: string;
  contentType: string;
  trustLevel: string;
  priority?: string;
  externalId?: string;
  baseUrl?: string;
  profileUrl?: string;
  regionScopes?: string[];
  verificationStatus?: string;
  keywords?: string[];
  collectionMode?: string;
}

// POST /api/sources/import — 批量导入来源，按 externalId+platform 去重
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const body = await request.json();
    const sources: ImportSource[] = Array.isArray(body) ? body : body.sources;

    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: "请提供来源数组 (body 为数组或 { sources: [...] })" },
        { status: 400 }
      );
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const src of sources) {
      if (!src.name || !src.platform || !src.contentType || !src.trustLevel) {
        results.errors.push(
          `${src.name ?? "未知"}: 缺少必填字段 name/platform/contentType/trustLevel`
        );
        continue;
      }

      // 按 externalId+platform 去重；无 externalId 则按 name+platform
      const existing = src.externalId
        ? await db.source.findFirst({
            where: {
              externalId: src.externalId,
              platform: src.platform,
              archivedAt: null,
            },
          })
        : await db.source.findFirst({
            where: {
              name: src.name,
              platform: src.platform,
              archivedAt: null,
            },
          });

      if (existing) {
        results.skipped++;
        continue;
      }

      await db.source.create({
        data: {
          name: src.name,
          externalId: src.externalId ?? null,
          platform: src.platform,
          contentType: src.contentType,
          trustLevel: src.trustLevel,
          priority: src.priority ?? "P2",
          regionScopes: JSON.stringify(src.regionScopes ?? []),
          verificationStatus: src.verificationStatus ?? "unverified",
          baseUrl: src.baseUrl ?? null,
          profileUrl: src.profileUrl ?? null,
          keywords: JSON.stringify(src.keywords ?? []),
          collectionMode: src.collectionMode ?? null,
        },
      });

      results.created++;
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("批量导入来源失败:", error);
    return NextResponse.json(
      { error: "批量导入来源失败" },
      { status: 500 }
    );
  }
}
