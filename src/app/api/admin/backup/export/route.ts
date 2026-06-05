import { NextResponse } from "next/server";
import { createBackupArchive, resolveDatabaseFilePath } from "@/lib/backup";
import { resolveUploadsDirectoryPath } from "@/lib/backup";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const dbPath = resolveDatabaseFilePath();
    const uploadsDir = resolveUploadsDirectoryPath();
    const archive = await createBackupArchive({ dbPath, uploadsDir });
    const filename = `shenlun-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;

    await logger.info("Exported system backup", "BACKUP", { dbPath, uploadsDir, bytes: archive.byteLength });

    return new NextResponse(new Uint8Array(archive), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    await logger.error("Failed to export backup", "BACKUP", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出备份失败" },
      { status: 500 }
    );
  }
}
