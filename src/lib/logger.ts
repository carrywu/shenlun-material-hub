import { db } from "./db";

export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogCategory = "SYSTEM" | "CRAWLER" | "AI" | "AUTH" | "BACKUP";

export const logger = {
  async info(message: string, category: LogCategory = "SYSTEM", detail?: string | object) {
    await this.log("INFO", category, message, detail);
  },

  async warn(message: string, category: LogCategory = "SYSTEM", detail?: string | object) {
    await this.log("WARN", category, message, detail);
  },

  async error(message: string, category: LogCategory = "SYSTEM", detail?: string | object) {
    await this.log("ERROR", category, message, detail);
  },

  async log(level: LogLevel, category: LogCategory, message: string, detail?: string | object) {
    const formattedDetail = typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail;
    const timestamp = new Date().toISOString();
    
    // 1. 输出到控制台 (Stdout/Stderr)
    const logLine = `[${timestamp}] [${level}] [${category}] ${message}${formattedDetail ? `\nDetail: ${formattedDetail}` : ""}`;
    if (level === "ERROR") {
      console.error(logLine);
    } else if (level === "WARN") {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    // 2. 写入数据库 (SystemLog 表)
    try {
      await db.systemLog.create({
        data: {
          level,
          category,
          message,
          detail: formattedDetail || null,
        },
      });
    } catch (dbError) {
      // 避免递归写入失败崩溃，控制台记录即可
      console.error(`[${timestamp}] [ERROR] [SYSTEM] Failed to write log to database:`, dbError);
    }
  }
};
