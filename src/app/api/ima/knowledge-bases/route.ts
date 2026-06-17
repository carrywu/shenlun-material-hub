import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { listKnowledgeBasesForCredentials } from "@/services/ima-sync";

// POST /api/ima/knowledge-bases — 用临时凭证（clientId + apiKey）拉取该账号下可用知识库列表。
// 仅用于「设置 → IMA」配置页下拉选择。凭证只在内存中用于本次请求，不落盘、不外发第三方（仅 ima.qq.com）。
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
    return forbiddenResponse();
  }

  try {
    const body = await request.json();
    const { clientId, apiKey, baseUrl } = body as {
      clientId?: string;
      apiKey?: string;
      baseUrl?: string;
    };

    if (!clientId || !apiKey) {
      return NextResponse.json(
        { error: "请填写 Client ID 和 API Key" },
        { status: 400 }
      );
    }

    const list = await listKnowledgeBasesForCredentials({
      clientId: String(clientId).trim(),
      apiKey: String(apiKey).trim(),
      baseUrl: baseUrl || undefined,
    });

    return NextResponse.json({ data: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "拉取知识库列表失败";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
