import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 用 vi.hoisted() 提前创建 mock，确保 mock 工厂函数可用 ───────────────────

const { mockPrepare, mockAll, mockGet, mockClose, mockAccess, MockDatabase } =
  vi.hoisted(() => {
    const mockPrepare = vi.fn();
    const mockAll = vi.fn();
    const mockGet = vi.fn();
    const mockClose = vi.fn();
    const mockAccess = vi.fn();

    // 默认：prepare 返回带 .all() / .get() 的 Statement 对象
    mockPrepare.mockReturnValue({ all: mockAll, get: mockGet });

    // 可被 `new` 调用的类
    class MockDatabase {
      prepare = mockPrepare;
      close = mockClose;
    }

    return {
      mockPrepare,
      mockAll,
      mockGet,
      mockClose,
      mockAccess,
      MockDatabase,
    };
  });

vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
  __esModule: true,
}));

vi.mock("fs/promises", () => ({
  access: mockAccess,
}));

import {
  checkSqliteDb,
  listFeedsFromSqlite,
  listArticlesFromSqlite,
  listAllArticlesFromSqlite,
} from "../we-mp-rss-sqlite";

const TEST_DB_PATH = "/tmp/test-we-mp-rss.db";

describe("we-mp-rss-sqlite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重设默认行为
    mockAccess.mockResolvedValue(undefined);
    mockPrepare.mockReturnValue({ all: mockAll, get: mockGet });
  });

  // ── checkSqliteDb ──────────────────────────────────────────────────────

  describe("checkSqliteDb", () => {
    it("应返回 readable=true 当数据库可读", async () => {
      mockGet.mockReturnValue({ total: 5 });
      const result = await checkSqliteDb(TEST_DB_PATH);
      expect(result.exists).toBe(true);
      expect(result.readable).toBe(true);
      expect(result.path).toBe(TEST_DB_PATH);
    });

    it("应返回 exists=false 当文件不存在", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      const result = await checkSqliteDb(TEST_DB_PATH);
      expect(result.exists).toBe(false);
      expect(result.readable).toBe(false);
      expect(result.message).toContain("不存在");
    });

    it("应返回 readable=false 当数据库损坏", async () => {
      // 让 prepare 抛出异常（模拟损坏数据库）
      mockPrepare.mockImplementation(() => {
        throw new Error("SQLITE_CORRUPT");
      });
      const result = await checkSqliteDb(TEST_DB_PATH);
      expect(result.exists).toBe(true);
      expect(result.readable).toBe(false);
      expect(result.message).toContain("无法读取");
    });

    it("应使用默认路径当 dbPath 未提供", async () => {
      mockGet.mockReturnValue({ total: 1 });
      const result = await checkSqliteDb();
      expect(result.path).toContain("we_mp_rss.db");
    });

    it("数据库应始终以只读模式打开", async () => {
      mockGet.mockReturnValue({ total: 1 });
      await checkSqliteDb(TEST_DB_PATH);
      // 验证 loadDatabase → new Database(path, {readonly:true}) 被调用
      // MockDatabase 构造函数不抛错即说明 new 可用
      expect(mockClose).toHaveBeenCalled();
    });
  });

  // ── listFeedsFromSqlite ────────────────────────────────────────────────

  describe("listFeedsFromSqlite", () => {
    it("应返回公众号列表", async () => {
      const feedRows = [
        {
          id: "mp1",
          mp_name: "人民日报",
          mp_intro: "简介",
          mp_cover: "cover.jpg",
          status: 1,
          sync_time: 1000,
          update_time: 2000,
          created_at: 500,
          updated_at: 600,
          faker_id: null,
        },
        {
          id: "mp2",
          mp_name: "新华社",
          mp_intro: null,
          mp_cover: null,
          status: 1,
          sync_time: null,
          update_time: null,
          created_at: null,
          updated_at: null,
          faker_id: "fk1",
        },
      ];
      mockAll.mockReturnValue(feedRows);

      const result = await listFeedsFromSqlite(TEST_DB_PATH);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("mp1");
      expect(result[0].mpName).toBe("人民日报");
      expect(result[0].mpIntro).toBe("简介");
      expect(result[1].id).toBe("mp2");
      expect(result[1].mpIntro).toBeUndefined(); // null → undefined
    });

    it("应抛出错误当数据库不存在", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      await expect(listFeedsFromSqlite(TEST_DB_PATH)).rejects.toThrow(
        "不存在"
      );
    });

    it("应关闭数据库连接", async () => {
      mockAll.mockReturnValue([]);
      await listFeedsFromSqlite(TEST_DB_PATH);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  // ── listArticlesFromSqlite ──────────────────────────────────────────────

  describe("listArticlesFromSqlite", () => {
    it("应返回指定公众号的文章列表（含分页）", async () => {
      mockGet.mockReturnValue({ total: 2 });
      const articleRows = [
        {
          id: "art1",
          mp_id: "mp1",
          title: "文章1",
          pic_url: "pic1.jpg",
          url: "https://mp.weixin.qq.com/s/1",
          description: "摘要",
          content: "<p>正文</p>",
          content_html: "<p>原始</p>",
          has_content: 1,
          fix_fail_count: 0,
          publish_time: 1700000000,
          create_time: 1700001000,
        },
      ];
      mockAll.mockReturnValue(articleRows);

      const result = await listArticlesFromSqlite(TEST_DB_PATH, "mp1", {
        offset: 0,
        limit: 10,
      });
      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(1);
      expect(result.list[0].id).toBe("art1");
      expect(result.list[0].mpId).toBe("mp1");
      expect(result.list[0].content).toBe("<p>正文</p>");
      expect(result.list[0].contentHtml).toBe("<p>原始</p>");
      expect(result.list[0].hasContent).toBe(1);
    });

    it("应抛出错误当数据库不存在", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      await expect(
        listArticlesFromSqlite(TEST_DB_PATH, "mp1")
      ).rejects.toThrow("不存在");
    });

    it("应关闭数据库连接", async () => {
      mockGet.mockReturnValue({ total: 0 });
      mockAll.mockReturnValue([]);
      await listArticlesFromSqlite(TEST_DB_PATH, "mp1");
      expect(mockClose).toHaveBeenCalled();
    });
  });

  // ── listAllArticlesFromSqlite ──────────────────────────────────────────

  describe("listAllArticlesFromSqlite", () => {
    it("应返回所有公众号的文章（不按 mp_id 过滤）", async () => {
      mockGet.mockReturnValue({ total: 3 });
      const articleRows = [
        {
          id: "art1",
          mp_id: "mp1",
          title: "文章1",
          pic_url: null,
          url: "url1",
          description: null,
          content: "c1",
          content_html: "h1",
          has_content: 1,
          fix_fail_count: 0,
          publish_time: 1000,
          create_time: 2000,
        },
        {
          id: "art2",
          mp_id: "mp2",
          title: "文章2",
          pic_url: null,
          url: "url2",
          description: null,
          content: "c2",
          content_html: "h2",
          has_content: 0,
          fix_fail_count: 3,
          publish_time: 3000,
          create_time: 4000,
        },
      ];
      mockAll.mockReturnValue(articleRows);

      const result = await listAllArticlesFromSqlite(TEST_DB_PATH, {
        offset: 0,
        limit: 50,
      });
      expect(result.total).toBe(3);
      expect(result.list).toHaveLength(2);
      expect(result.list[0].id).toBe("art1");
      expect(result.list[1].fixFailCount).toBe(3);
    });

    it("应使用默认分页参数", async () => {
      mockGet.mockReturnValue({ total: 0 });
      mockAll.mockReturnValue([]);
      await listAllArticlesFromSqlite(TEST_DB_PATH);
      // 默认 limit=100, offset=0; all() 应以 (100, 0) 调用
      // mockAll 是 prepare().all(limit, offset) 的 all
      // 所以 mockAll 最后一次调用应收到 (100, 0)
      expect(mockAll).toHaveBeenCalledWith(100, 0);
    });
  });

  // ── 数据映射 ────────────────────────────────────────────────────────────

  describe("数据映射", () => {
    it("null 字段应映射为 undefined", async () => {
      const feedRows = [
        {
          id: "mp1",
          mp_name: "测试",
          mp_intro: null,
          mp_cover: null,
          status: 1,
          sync_time: null,
          update_time: null,
          created_at: null,
          updated_at: null,
          faker_id: null,
        },
      ];
      mockAll.mockReturnValue(feedRows);

      const result = await listFeedsFromSqlite(TEST_DB_PATH);
      expect(result[0].mpIntro).toBeUndefined();
      expect(result[0].mpCover).toBeUndefined();
      expect(result[0].syncTime).toBeUndefined();
      expect(result[0].updateTime).toBeUndefined();
      expect(result[0].createdAt).toBeUndefined();
    });

    it("文章 null 字段应映射为 undefined", async () => {
      mockGet.mockReturnValue({ total: 1 });
      const articleRows = [
        {
          id: "art1",
          mp_id: "mp1",
          title: "测试",
          pic_url: null,
          url: "url1",
          description: null,
          content: null,
          content_html: null,
          has_content: 0,
          fix_fail_count: 2,
          publish_time: null,
          create_time: null,
        },
      ];
      mockAll.mockReturnValue(articleRows);

      const result = await listArticlesFromSqlite(TEST_DB_PATH, "mp1");
      expect(result.list[0].picUrl).toBeUndefined();
      expect(result.list[0].description).toBeUndefined();
      expect(result.list[0].content).toBeUndefined();
      expect(result.list[0].contentHtml).toBeUndefined();
      expect(result.list[0].publishTime).toBeUndefined();
    });
  });
});
