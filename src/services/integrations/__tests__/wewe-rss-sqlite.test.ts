import { describe, expect, it } from "vitest";

/**
 * WeWe RSS SQLite Fallback — Read-only constraint test
 *
 * The wewe-rss-sqlite.ts module opens the sidecar WeWe RSS SQLite database
 * in readonly: true mode. This test verifies the module is importable
 * and documents the read-only constraint.
 */
describe("WeWe RSS SQLite fallback — read-only constraint", () => {
  it("should export listFeedsFromSqlite as a read-only function", async () => {
    const mod = await import("@/services/integrations/wewe-rss-sqlite");
    expect(typeof mod.listFeedsFromSqlite).toBe("function");
  });

  it("should export checkSqliteDb as a read-only diagnostic function", async () => {
    const mod = await import("@/services/integrations/wewe-rss-sqlite");
    expect(typeof mod.checkSqliteDb).toBe("function");
  });

  it("read-only constraint: module does NOT export any write functions", async () => {
    const mod = await import("@/services/integrations/wewe-rss-sqlite");
    const exportedKeys = Object.keys(mod);
    const writePatterns = ["insert", "update", "delete", "create", "write", "modify", "remove"];
    for (const key of exportedKeys) {
      for (const pattern of writePatterns) {
        expect(key.toLowerCase()).not.toContain(pattern);
      }
    }
  });
});
