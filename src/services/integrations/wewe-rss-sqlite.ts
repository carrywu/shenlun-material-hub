/**
 * WeWe RSS SQLite 只读同步服务
 * 作为 API 的兜底方案，只读读取 wewe-rss.db 中的公众号列表。
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";

export interface WeweRssFeedFromDb {
  id: string;        // MP_WXS_xxx
  name: string;      // 公众号名称
  intro?: string;    // 简介
  cover?: string;    // 头像
  status: number;    // 1=启用, 0=禁用
  syncTime?: number; // 最近同步时间戳
  updateTime?: number; // 最近更新时间戳
}

const DEFAULT_DB_PATH = "infra/wechat-rss/wewe-rss/data/wewe-rss.db";

/**
 * 检查 SQLite 数据库文件是否存在且可读。
 */
export function checkSqliteDb(dbPath?: string): {
  exists: boolean;
  readable: boolean;
  message: string;
  path: string;
} {
  const path = dbPath ?? DEFAULT_DB_PATH;
  const exists = existsSync(path);

  if (!exists) {
    return {
      exists: false,
      readable: false,
      message: `数据库文件不存在: ${path}。请先启动 WeWe RSS 并添加公众号。`,
      path,
    };
  }

  try {
    const db = new Database(path, { readonly: true });
    // 测试查询
    db.prepare("SELECT COUNT(*) FROM feeds").get();
    db.close();
    return {
      exists: true,
      readable: true,
      message: "SQLite 数据库可读",
      path,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exists: true,
      readable: false,
      message: `SQLite 数据库无法读取: ${msg}`,
      path,
    };
  }
}

/**
 * 从 SQLite 只读获取公众号列表。
 */
export function listFeedsFromSqlite(
  dbPath?: string
): WeweRssFeedFromDb[] {
  const path = dbPath ?? DEFAULT_DB_PATH;

  if (!existsSync(path)) {
    throw new Error(`SQLite 数据库不存在: ${path}`);
  }

  const db = new Database(path, { readonly: true });

  try {
    const rows = db
      .prepare(
        `SELECT id, mp_name as name, mp_intro as intro, mp_cover as cover,
                status, sync_time as syncTime, update_time as updateTime
         FROM feeds
         ORDER BY mp_name`
      )
      .all() as WeweRssFeedFromDb[];

    return rows;
  } finally {
    db.close();
  }
}
