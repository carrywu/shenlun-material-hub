/**
 * we-mp-rss SQLite 只读同步服务
 * 作为 API 不可达时的兜底方案，只读读取 we_mp_rss.db。
 * 禁止写入 we-mp-rss.db（CLAUDE.md 约束）。
 */

import path from "path";

import type { WeMpRssFeed, WeMpRssArticle } from "./we-mp-rss-api";

// ── 类型 ────────────────────────────────────────────────────────────────

export interface SqliteCheckResult {
  exists: boolean;
  readable: boolean;
  message: string;
  path: string;
}

export interface SqliteFeedRow {
  id: string;
  mp_name: string;
  mp_intro: string | null;
  mp_cover: string | null;
  status: number;
  sync_time: number | null;
  update_time: number | null;
  created_at: number | null;
  updated_at: number | null;
  faker_id: string | null;
}

export interface SqliteArticleRow {
  id: string;
  mp_id: string;
  title: string;
  pic_url: string | null;
  url: string;
  description: string | null;
  content: string | null;
  content_html: string | null;
  has_content: number;
  fix_fail_count: number;
  publish_time: number | null;
  create_time: number | null;
}

// ── 常量 ────────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "infra",
  "wechat-rss",
  "we-mp-rss",
  "data",
  "we_mp_rss.db"
);

// ── 内部工具 ─────────────────────────────────────────────────────────────

async function loadDatabase() {
  const { default: Database } = await import("better-sqlite3");
  return Database;
}

async function fileExists(dbPath: string): Promise<boolean> {
  const { access } = await import("fs/promises");
  try {
    await access(dbPath);
    return true;
  } catch {
    return false;
  }
}

/** 将 SQLite 行转换为 WeMpRssFeed 接口 */
function mapFeedRow(row: SqliteFeedRow): WeMpRssFeed {
  return {
    id: row.id,
    mpName: row.mp_name,
    mpIntro: row.mp_intro ?? undefined,
    mpCover: row.mp_cover ?? undefined,
    status: row.status,
    syncTime: row.sync_time ?? undefined,
    updateTime: row.update_time ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

/** 将 SQLite 行转换为 WeMpRssArticle 接口 */
function mapArticleRow(row: SqliteArticleRow): WeMpRssArticle {
  return {
    id: row.id,
    mpId: row.mp_id,
    title: row.title,
    picUrl: row.pic_url ?? undefined,
    url: row.url,
    description: row.description ?? undefined,
    content: row.content ?? undefined,
    contentHtml: row.content_html ?? undefined,
    hasContent: row.has_content,
    fixFailCount: row.fix_fail_count,
    publishTime: row.publish_time ?? undefined,
    createdAt: row.create_time ?? undefined,
  };
}

// ── 导出函数 ─────────────────────────────────────────────────────────────

/**
 * 检查 SQLite 数据库文件是否存在且可读。
 */
export async function checkSqliteDb(
  dbPath?: string
): Promise<SqliteCheckResult> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
  const exists = await fileExists(resolvedPath);

  if (!exists) {
    return {
      exists: false,
      readable: false,
      message: `数据库文件不存在: ${resolvedPath}。请先启动 we-mp-rss 并添加公众号。`,
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
): Promise<WeMpRssFeed[]> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`SQLite 数据库不存在: ${resolvedPath}`);
  }

  const Database = await loadDatabase();
  const db = new Database(resolvedPath, { readonly: true });

  try {
    const rows = db
      .prepare(
        `SELECT id, mp_name, mp_intro, mp_cover,
                status, sync_time, update_time,
                created_at, updated_at, faker_id
         FROM feeds
         ORDER BY mp_name`
      )
      .all() as SqliteFeedRow[];

    return rows.map(mapFeedRow);
  } finally {
    db.close();
  }
}

/**
 * 从 SQLite 只读获取指定公众号的文章列表（含 content）。
 * 支持按 mp_id 过滤和分页。
 */
export async function listArticlesFromSqlite(
  dbPath: string | undefined,
  mpId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{ list: WeMpRssArticle[]; total: number }> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`SQLite 数据库不存在: ${resolvedPath}`);
  }

  const Database = await loadDatabase();
  const db = new Database(resolvedPath, { readonly: true });

  try {
    // 总数
    const countRow = db
      .prepare("SELECT COUNT(*) as total FROM articles WHERE mp_id = ?")
      .get(mpId) as { total: number } | undefined;

    const total = countRow?.total ?? 0;

    // 分页查询
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    const rows = db
      .prepare(
        `SELECT id, mp_id, title, pic_url, url, description,
                content, content_html, has_content, fix_fail_count,
                publish_time, create_time
         FROM articles
         WHERE mp_id = ?
         ORDER BY publish_time DESC
         LIMIT ? OFFSET ?`
      )
      .all(mpId, limit, offset) as SqliteArticleRow[];

    return {
      list: rows.map(mapArticleRow),
      total,
    };
  } finally {
    db.close();
  }
}

/**
 * 从 SQLite 只读获取所有公众号的文章（遍历全部 mp_id）。
 * 用于全量同步场景。
 */
export async function listAllArticlesFromSqlite(
  dbPath: string | undefined,
  options: { offset?: number; limit?: number } = {}
): Promise<{ list: WeMpRssArticle[]; total: number }> {
  const resolvedPath = dbPath ?? DEFAULT_DB_PATH;

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`SQLite 数据库不存在: ${resolvedPath}`);
  }

  const Database = await loadDatabase();
  const db = new Database(resolvedPath, { readonly: true });

  try {
    // 总数
    const countRow = db
      .prepare("SELECT COUNT(*) as total FROM articles")
      .get() as { total: number } | undefined;

    const total = countRow?.total ?? 0;

    // 分页查询
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    const rows = db
      .prepare(
        `SELECT id, mp_id, title, pic_url, url, description,
                content, content_html, has_content, fix_fail_count,
                publish_time, create_time
         FROM articles
         ORDER BY publish_time DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as SqliteArticleRow[];

    return {
      list: rows.map(mapArticleRow),
      total,
    };
  } finally {
    db.close();
  }
}
