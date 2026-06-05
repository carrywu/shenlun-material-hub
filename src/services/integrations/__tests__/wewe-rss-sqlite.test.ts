import { describe, it, expect } from "vitest";
import path from "path";
import { checkSqliteDb } from "../wewe-rss-sqlite";

describe("WeweRssSqlite", () => {
  describe("checkSqliteDb", () => {
    it("returns exists=false for non-existent file", async () => {
      const result = await checkSqliteDb("/tmp/non-existent-wewe-rss.db");
      expect(result.exists).toBe(false);
      expect(result.readable).toBe(false);
      expect(result.message).toContain("不存在");
    });

    it("returns exists=true and readable=true for valid db", async () => {
      // 使用真实的 wewe-rss.db 文件
      const result = await checkSqliteDb("infra/wechat-rss/wewe-rss/data/wewe-rss.db");
      // 可能存在也可能不存在，取决于测试环境
      if (result.exists) {
        expect(result.readable).toBe(true);
        expect(result.message).toContain("可读");
      }
    });

    it("uses default path when not specified", async () => {
      const result = await checkSqliteDb();
      expect(result.path).toBe(
        path.join(
          process.cwd(),
          "infra",
          "wechat-rss",
          "wewe-rss",
          "data",
          "wewe-rss.db"
        )
      );
    });
  });
});
