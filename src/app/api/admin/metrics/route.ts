import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import os from "os";
import fs from "fs";

function readDiskStats(): { percent: number; freeGb: number } {
  if (typeof fs.statfsSync !== "function") {
    return { percent: 0, freeGb: 0 };
  }

  try {
    const stats = fs.statfsSync(process.cwd());
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;

    if (totalBytes <= 0) {
      return { percent: 0, freeGb: 0 };
    }

    const usedPercent = Number((((totalBytes - freeBytes) / totalBytes) * 100).toFixed(1));
    const freeGb = Number((freeBytes / (1024 * 1024 * 1024)).toFixed(2));
    return { percent: usedPercent, freeGb };
  } catch {
    return { percent: 0, freeGb: 0 };
  }
}

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }

  try {
    // 1. 获取数据库统计数据
    const totalArticles = await db.contentItem.count();
    const totalSources = await db.source.count();
    
    const activeTasks = await db.asyncTask.count({
      where: {
        status: { in: ["PENDING", "RUNNING"] }
      }
    });

    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedTasks24h = await db.asyncTask.count({
      where: {
        status: "FAILED",
        createdAt: { gte: past24h }
      }
    });

    const errorLogs24h = await db.systemLog.count({
      where: {
        level: "ERROR",
        createdAt: { gte: past24h }
      }
    });

    // 2. 获取数据库大小 — 使用 PostgreSQL 查询
    let dbSizeMb = 0;
    try {
      const result = await db.$queryRaw<Array<{ pg_database_size: bigint }>>`
        SELECT pg_database_size(current_database()) as pg_database_size
      `;
      if (result[0]?.pg_database_size) {
        dbSizeMb = Number((Number(result[0].pg_database_size) / (1024 * 1024)).toFixed(2));
      }
    } catch (e) {
      console.error("Failed to query database size:", e);
    }

    // 3. 获取硬件资源情况
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemPercent = Number(((totalMemBytes - freeMemBytes) / totalMemBytes * 100).toFixed(1));
    const memoryMb = {
      total: Math.round(totalMemBytes / (1024 * 1024)),
      used: Math.round((totalMemBytes - freeMemBytes) / (1024 * 1024)),
      percent: usedMemPercent
    };

    const cpuLoad = os.loadavg(); // 1, 5, 15 min load average
    const cpuCount = os.cpus().length;
    const cpuUsagePercent = Number(((cpuLoad[0] / cpuCount) * 100).toFixed(1));

    const disk = readDiskStats();

    // 4. 获取最近 5 个失败的同步/采集日志
    const recentErrors = await db.systemLog.findMany({
      where: { level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    // 5. 获取最近 5 个任务
    const recentTasks = await db.asyncTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    });

    return NextResponse.json({
      dbStats: {
        totalArticles,
        totalSources,
        activeTasks,
        failedTasks24h,
        errorLogs24h,
        dbSizeMb
      },
      systemStats: {
        memory: memoryMb,
        cpu: {
          percent: cpuUsagePercent,
          cores: cpuCount
        },
        disk,
        os: `${os.type()} ${os.release()} (${os.arch()})`
      },
      recentErrors,
      recentTasks
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin metrics API error:", message);
    return NextResponse.json({
      dbStats: {
        totalArticles: 0,
        totalSources: 0,
        activeTasks: 0,
        failedTasks24h: 0,
        errorLogs24h: 0,
        dbSizeMb: 0
      },
      systemStats: {
        memory: { total: 0, used: 0, percent: 0 },
        cpu: { percent: 0, cores: 0 },
        disk: { percent: 0, freeGb: 0 },
        os: "Unknown"
      },
      recentErrors: [],
      recentTasks: []
    }, { status: 500 });
  }
}
