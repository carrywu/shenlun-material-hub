/**
 * WeWe RSS SQLite 只读同步服务
 * 作为 API 的兜底方案，只读读取 wewe-rss.db 中的公众号列表。
 */

import path from "path";

export interface WeweRssFeedFromDb {
  id: string;        // MP_WXS_xxx
  name: string;      // 公众号名称
  intro?: string;    // 简介
  cover?: string;    // 头像
  status: number;    // 1=启用, 0=禁用
  syncTime?: number; // 最近同步时间戳
  updateTime?: number; // 最近更新时间戳
}

const DEFAULT_DB_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "infra",
  "wechat-rss",
  "wewe-rss",
  "data",
  "wewe-rss.db"
);

async function loadDatabase() {
  const { default: Database } = await import("better-sqlite3");
  return Database;
}

async function fileExists(dbPath: string) {
  const { access } = await import("fs/promises");

  try {
    await access(dbPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 SQLite 数据库文件是否存在且可读。
 */
export async function checkSqliteDb(dbPath?: string): Promise<{
  exists: boolean;
  readable: boolean;
  message: string;
  path: string;
}> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
  const exists = await fileExists(resolvedPath);

  if (!exists) {
    return {
      exists: false,
      readable: false,
      message: `数据库文件不存在: ${resolvedPath}。请先启动 WeWe RSS 并添加公众号。`,
      path: resolvedPath,
    };
  }

  try {
    const Database = await loadDatabase();
    const db = new Database(resolvedPath, { readonly: true });
    // 测试查询
    db.prepare("SELECT COUNT(*) FROM feeds").get();
    db.close();
    return {
      exists: true,
      readable: true,
      message: "SQLite 数据库可读",
      path: resolvedPath,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exists: true,
      readable: false,
      message: `SQLite 数据库无法读取: ${msg}`,
      path: resolvedPath,
    };
  }
}

/**
 * 从 SQLite 只读获取公众号列表。
 */
export async function listFeedsFromSqlite(
  dbPath?: string
): Promise<WeweRssFeedFromDb[]> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`SQLite 数据库不存在: ${resolvedPath}`);
  }

  const Database = await loadDatabase();
  const db = new Database(resolvedPath, { readonly: true });

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
