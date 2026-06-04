import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assertPromptTemplateKey,
  DEFAULT_PROMPT_TEMPLATES,
  PROMPT_TEMPLATE_DEFINITIONS,
} from "@/services/ai";

type PromptRecord = {
  key: string;
  content: string;
  defaultContent: string | null;
  enabled: boolean;
  version: number;
  updatedAt: Date;
};

function promptClient() {
  return (db as unknown as {
    aiPromptTemplate: {
      findMany: (args: { where: { key: { in: string[] } } }) => Promise<PromptRecord[]>;
      upsert: (args: {
        where: { key: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<PromptRecord>;
    };
  }).aiPromptTemplate;
}

export async function GET() {
  try {
    const definitions = PROMPT_TEMPLATE_DEFINITIONS;
    const records = await promptClient().findMany({
      where: { key: { in: definitions.map((definition) => definition.key) } },
    });
    const recordMap = new Map(records.map((record) => [record.key, record]));

    return NextResponse.json({
      templates: definitions.map((definition) => {
        const record = recordMap.get(definition.key);
        const defaultContent = DEFAULT_PROMPT_TEMPLATES[definition.key];
        return {
          ...definition,
          content: record?.content ?? defaultContent,
          defaultContent: record?.defaultContent ?? defaultContent,
          enabled: record?.enabled ?? true,
          version: record?.version ?? 1,
          customized: !!record && record.content.trim() !== defaultContent.trim(),
          updatedAt: record?.updatedAt ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("获取提示词配置失败:", error);
    return NextResponse.json({ error: "获取提示词配置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const key = assertPromptTemplateKey(String(body.key ?? ""));
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "提示词内容不能为空" }, { status: 400 });
    }

    const definition = PROMPT_TEMPLATE_DEFINITIONS.find((item) => item.key === key);
    const defaultContent = DEFAULT_PROMPT_TEMPLATES[key];

    await promptClient().upsert({
      where: { key },
      update: {
        name: definition?.name ?? key,
        description: definition?.description ?? null,
        content,
        defaultContent,
        enabled: true,
        version: { increment: 1 },
      },
      create: {
        key,
        name: definition?.name ?? key,
        description: definition?.description ?? null,
        content,
        defaultContent,
        enabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存提示词失败";
    const status = message === "无效的提示词类型" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const key = assertPromptTemplateKey(String(body.key ?? ""));
    const definition = PROMPT_TEMPLATE_DEFINITIONS.find((item) => item.key === key);
    const defaultContent = DEFAULT_PROMPT_TEMPLATES[key];

    await promptClient().upsert({
      where: { key },
      update: {
        name: definition?.name ?? key,
        description: definition?.description ?? null,
        content: defaultContent,
        defaultContent,
        enabled: true,
        version: { increment: 1 },
      },
      create: {
        key,
        name: definition?.name ?? key,
        description: definition?.description ?? null,
        content: defaultContent,
        defaultContent,
        enabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "恢复默认提示词失败";
    const status = message === "无效的提示词类型" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
