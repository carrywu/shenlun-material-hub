import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthConfig, verifyPassword } from "@/lib/auth";
import {
  inspectBackupDatabase,
  parseBackupArchive,
  resolveDatabaseFilePath,
  resolveUploadsDirectoryPath,
  restoreBackupArchive,
  summarizeBackupArchive,
} from "@/lib/backup";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const apply = formData.get("apply") === "true";
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传备份文件" }, { status: 400 });
    }

    const manifest = await parseBackupArchive(Buffer.from(await file.arrayBuffer()));
    const summary = summarizeBackupArchive(manifest);
    const backupCounts = await inspectBackupDatabase(manifest);
    const currentCounts = {
      contentItems: await db.contentItem.count(),
      sources: await db.source.count(),
      materialCards: await db.materialCard.count(),
    };

    const preview = {
      summary,
      backupCounts,
      currentCounts,
      willOverwrite: true,
    };

    if (!apply) {
      return NextResponse.json({ success: true, preview, dryRun: true });
    }

    const authConfigResult = getAuthConfig();
    if (!authConfigResult.ok) {
      return NextResponse.json({ error: authConfigResult.message }, { status: 500 });
    }

    if (!confirmPassword) {
      return NextResponse.json({ error: "恢复前必须输入管理员密码" }, { status: 400 });
    }

    const passwordOk = await verifyPassword(confirmPassword, authConfigResult.config.passwordHash);
    if (!passwordOk) {
      await logger.warn("Backup restore rejected due to invalid password confirmation", "BACKUP");
      return NextResponse.json({ error: "管理员密码校验失败" }, { status: 401 });
    }

    const dbPath = resolveDatabaseFilePath();
    const uploadsDir = resolveUploadsDirectoryPath();
    await restoreBackupArchive(manifest, { dbPath, uploadsDir });

    await logger.warn("Applied system backup restore", "BACKUP", {
      dbPath,
      uploadsDir,
      backupCounts,
      currentCounts,
    });

    return NextResponse.json({ success: true, preview, applied: true });
  } catch (error) {
    await logger.error("Failed to import backup", "BACKUP", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入备份失败" },
      { status: 500 }
    );
  }
}
