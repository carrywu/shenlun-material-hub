#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const defaultDbPath = path.join(projectRoot, "prisma", "dev.db");

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const SAFE_PRAGMA_PATTERN =
  /^pragma\s+(table_info|index_list|index_info|foreign_key_list|database_list|schema_version|user_version|quick_check|integrity_check)\b/i;
const SAFE_SQL_PATTERN = /^\s*(select|with|explain|pragma)\b/i;
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|vacuum|reindex|analyze|begin|commit|rollback)\b/i;

function resolveDbPath() {
  return path.resolve(process.env.SHENLUN_SQLITE_DB_PATH || defaultDbPath);
}

function openDb() {
  return new Database(resolveDbPath(), {
    readonly: true,
    fileMustExist: true,
  });
}

function clampLimit(limit) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
}

function ensureReadonlySql(sql) {
  const text = String(sql ?? "").trim();
  if (!text) {
    throw new Error("SQL 不能为空。");
  }
  if (text.includes(";")) {
    throw new Error("只读 MCP 禁止多语句 SQL。");
  }
  if (!SAFE_SQL_PATTERN.test(text)) {
    throw new Error("只允许 SELECT、WITH、EXPLAIN 或安全 PRAGMA。");
  }
  if (/^\s*pragma\b/i.test(text) && !SAFE_PRAGMA_PATTERN.test(text)) {
    throw new Error("该 PRAGMA 不在只读白名单内。");
  }
  if (FORBIDDEN_SQL_PATTERN.test(text)) {
    throw new Error("只读 MCP 禁止写入、DDL、事务和维护类 SQL。");
  }
  return text;
}

function runReadonlyQuery(sql, limit = DEFAULT_LIMIT) {
  const safeSql = ensureReadonlySql(sql);
  const maxRows = clampLimit(limit);
  const db = openDb();
  try {
    const stmt = db.prepare(safeSql);
    const rows = stmt.all();
    return {
      dbPath: resolveDbPath(),
      rowCount: rows.length,
      returned: Math.min(rows.length, maxRows),
      rows: rows.slice(0, maxRows),
    };
  } finally {
    db.close();
  }
}

function getSchema() {
  const db = openDb();
  try {
    const tables = db
      .prepare(
        "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all();

    return {
      dbPath: resolveDbPath(),
      tables: tables.map((table) => ({
        name: table.name,
        type: table.type,
        columns: db.prepare(`PRAGMA table_info("${table.name.replaceAll('"', '""')}")`).all(),
        indexes: db.prepare(`PRAGMA index_list("${table.name.replaceAll('"', '""')}")`).all(),
        createSql: table.sql,
      })),
    };
  } finally {
    db.close();
  }
}

function querySystemLogs({ level, category, limit = DEFAULT_LIMIT } = {}) {
  const filters = [];
  const params = {};

  if (level) {
    filters.push("level = @level");
    params.level = level;
  }
  if (category) {
    filters.push("category = @category");
    params.category = category;
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sql = `SELECT id, level, category, message, detail, createdAt FROM SystemLog ${where} ORDER BY datetime(createdAt) DESC LIMIT @limit`;
  const db = openDb();
  try {
    const rows = db.prepare(sql).all({
      ...params,
      limit: clampLimit(limit),
    });
    return {
      dbPath: resolveDbPath(),
      rowCount: rows.length,
      rows,
    };
  } finally {
    db.close();
  }
}

function jsonToolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function createServer() {
  const server = new McpServer({
    name: "shenlun-sqlite-logs",
    version: "0.1.0",
  });

  server.registerTool(
    "db_schema",
    {
      title: "查看 SQLite Schema",
      description: "只读查看项目 SQLite 数据库中的表、字段、索引和建表 SQL。",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => jsonToolResult(getSchema())
  );

  server.registerTool(
    "db_query_readonly",
    {
      title: "执行只读 SQL",
      description: "只允许 SELECT、WITH、EXPLAIN 和白名单 PRAGMA；禁止写入、DDL、事务和多语句。",
      inputSchema: {
        sql: z.string().min(1),
        limit: z.number().int().positive().max(MAX_LIMIT).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ sql, limit }) => jsonToolResult(runReadonlyQuery(sql, limit))
  );

  server.registerTool(
    "system_logs_query",
    {
      title: "查询 SystemLog",
      description: "按 level/category 查询项目内 SystemLog，默认最多返回 50 条，最多 200 条。",
      inputSchema: {
        level: z.enum(["INFO", "WARN", "ERROR"]).optional(),
        category: z.enum(["SYSTEM", "CRAWLER", "AI", "AUTH", "BACKUP"]).optional(),
        limit: z.number().int().positive().max(MAX_LIMIT).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args) => jsonToolResult(querySystemLogs(args))
  );

  return server;
}

function selfTest() {
  const schema = getSchema();
  const one = runReadonlyQuery("SELECT name FROM sqlite_master WHERE type = 'table'", 5);
  const logs = querySystemLogs({ limit: 5 });

  let rejectedDangerousSql = false;
  try {
    runReadonlyQuery("DELETE FROM SystemLog", 1);
  } catch {
    rejectedDangerousSql = true;
  }

  let rejectedMultiStatement = false;
  try {
    runReadonlyQuery("SELECT 1; SELECT 2", 1);
  } catch {
    rejectedMultiStatement = true;
  }

  const result = {
    dbPath: resolveDbPath(),
    schemaTables: schema.tables.length,
    sampleQueryRows: one.returned,
    systemLogRows: logs.rowCount,
    rejectedDangerousSql,
    rejectedMultiStatement,
  };

  if (!schema.tables.length || !rejectedDangerousSql || !rejectedMultiStatement) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const server = createServer();
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
