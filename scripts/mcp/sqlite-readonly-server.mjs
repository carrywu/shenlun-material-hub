#!/usr/bin/env node

/**
 * PostgreSQL read-only MCP server
 * Replaces the SQLite-only version for use with PostgreSQL backend.
 *
 * Usage:
 *   node scripts/mcp/sqlite-readonly-server.mjs            # start MCP server
 *   node scripts/mcp/sqlite-readonly-server.mjs --self-test # run self-test
 *
 * Environment:
 *   DATABASE_URL  — PostgreSQL connection string (required)
 */

import pg from "pg";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const SAFE_SQL_PATTERN = /^\s*(select|with|explain)\b/i;
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|vacuum|reindex|analyze|begin|commit|rollback)\b/i;

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required.");
  }
  return new pg.Pool({ connectionString: url, max: 3 });
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
    throw new Error("只允许 SELECT、WITH、EXPLAIN。");
  }
  if (FORBIDDEN_SQL_PATTERN.test(text)) {
    throw new Error("只读 MCP 禁止写入、DDL、事务和维护类 SQL。");
  }
  return text;
}

async function runReadonlyQuery(sql, limit = DEFAULT_LIMIT) {
  const safeSql = ensureReadonlySql(sql);
  const maxRows = clampLimit(limit);
  const pool = getPool();
  try {
    const result = await pool.query(safeSql);
    const rows = result.rows.slice(0, maxRows);
    return {
      databaseUrl: maskUrl(process.env.DATABASE_URL),
      rowCount: result.rows.length,
      returned: rows.length,
      rows,
    };
  } finally {
    await pool.end();
  }
}

async function getSchema() {
  const pool = getPool();
  try {
    const tablesResult = await pool.query(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    const tables = [];
    for (const table of tablesResult.rows) {
      const columnsResult = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table.table_name]
      );

      const indexesResult = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
        [table.table_name]
      );

      tables.push({
        name: table.table_name,
        type: table.table_type === "BASE TABLE" ? "table" : "view",
        columns: columnsResult.rows,
        indexes: indexesResult.rows,
      });
    }

    return {
      databaseUrl: maskUrl(process.env.DATABASE_URL),
      tables,
    };
  } finally {
    await pool.end();
  }
}

async function querySystemLogs({ level, category, limit = DEFAULT_LIMIT } = {}) {
  const filters = [];
  const params = [];
  let paramIdx = 1;

  if (level) {
    filters.push(`level = $${paramIdx++}`);
    params.push(level);
  }
  if (category) {
    filters.push(`category = $${paramIdx++}`);
    params.push(category);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const clampedLimit = clampLimit(limit);
  params.push(clampedLimit);

  const sql = `SELECT id, level, category, message, detail, "createdAt" FROM "SystemLog" ${where} ORDER BY "createdAt" DESC LIMIT $${paramIdx}`;

  const pool = getPool();
  try {
    const result = await pool.query(sql, params);
    return {
      databaseUrl: maskUrl(process.env.DATABASE_URL),
      rowCount: result.rows.length,
      rows: result.rows,
    };
  } finally {
    await pool.end();
  }
}

function maskUrl(url) {
  if (!url) return "(not set)";
  return url.replace(/:[^:@]+@/, ":****@");
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
    name: "shenlun-pg-readonly",
    version: "0.2.0",
  });

  server.registerTool(
    "db_schema",
    {
      title: "查看 PostgreSQL Schema",
      description: "只读查看项目 PostgreSQL 数据库中的表、字段、索引和建表 SQL。",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => jsonToolResult(await getSchema())
  );

  server.registerTool(
    "db_query_readonly",
    {
      title: "执行只读 SQL",
      description: "只允许 SELECT、WITH、EXPLAIN；禁止写入、DDL、事务和多语句。",
      inputSchema: {
        sql: z.string().min(1),
        limit: z.number().int().positive().max(MAX_LIMIT).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ sql, limit }) => jsonToolResult(await runReadonlyQuery(sql, limit))
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
    async (args) => jsonToolResult(await querySystemLogs(args))
  );

  return server;
}

async function selfTest() {
  const schema = await getSchema();
  const one = await runReadonlyQuery("SELECT tablename FROM pg_tables WHERE schemaname = 'public'", 5);
  const logs = await querySystemLogs({ limit: 5 });

  let rejectedDangerousSql = false;
  try {
    await runReadonlyQuery("DELETE FROM \"SystemLog\"", 1);
  } catch {
    rejectedDangerousSql = true;
  }

  let rejectedMultiStatement = false;
  try {
    await runReadonlyQuery("SELECT 1; SELECT 2", 1);
  } catch {
    rejectedMultiStatement = true;
  }

  const result = {
    databaseUrl: maskUrl(process.env.DATABASE_URL),
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
    await selfTest();
    return;
  }

  const server = createServer();
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
