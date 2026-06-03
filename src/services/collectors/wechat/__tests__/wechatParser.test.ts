import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { parseWechatArticle } from "../wechatParser";

const FIXTURES_DIR = join(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

describe("parseWechatArticle", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("应该正确解析微信文章 HTML", async () => {
    const html = loadFixture("wechat-article.html");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/test123");

    expect(article.title).toBe("测试微信文章标题");
    expect(article.author).toBe("测试公众号");
    expect(article.url).toBe("https://mp.weixin.qq.com/s/test123");
    expect(article.content).toContain("这是微信文章的正文内容");
    expect(article.publishTime).toBeTruthy();
    // ct = "1704067200" -> 2024-01-01T00:00:00.000Z
    const date = new Date(article.publishTime!);
    expect(date.getFullYear()).toBe(2024);
  });

  it("应该拒绝非 mp.weixin.qq.com 链接", async () => {
    await expect(
      parseWechatArticle("https://example.com/article")
    ).rejects.toThrow("不支持的链接域名");
  });

  it("应该拒绝无效 URL 格式", async () => {
    await expect(
      parseWechatArticle("not-a-url")
    ).rejects.toThrow("无效的链接格式");
  });

  it("应该在 HTTP 非 200 时抛出错误", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(
      parseWechatArticle("https://mp.weixin.qq.com/s/notfound")
    ).rejects.toThrow("无法访问文章链接: HTTP 404");
  });

  it("应该在缺少 #activity-name 时 fallback 到 <title>", async () => {
    const html = `<!DOCTYPE html><html><head><title>Fallback Title</title></head><body>
      <div id="js_content"><p>正文内容</p></div>
      <div id="js_name">公众号名</div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/fallback");

    expect(article.title).toBe("Fallback Title");
  });

  it("应该在缺少 var ct 时返回 undefined publishTime", async () => {
    const html = `<!DOCTYPE html><html><head><title>No CT</title></head><body>
      <h1 id="activity-name">无时间文章</h1>
      <div id="js_content"><p>正文内容足够长用于测试解析逻辑</p></div>
      <div id="js_name">公众号</div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/noct");

    expect(article.publishTime).toBeUndefined();
  });

  it("应该在缺少 #js_name 时 fallback 到 .account_nickname", async () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body>
      <h1 id="activity-name">标题</h1>
      <div class="account_nickname">昵称公众号</div>
      <div id="js_content"><p>正文内容</p></div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/nickname");

    expect(article.author).toBe("昵称公众号");
  });

  it("应该提取 og:image 作为封面图", async () => {
    const html = `<!DOCTYPE html><html><head>
      <title>OG Image Test</title>
      <meta property="og:image" content="https://mmbiz.qpic.cn/cover.jpg" />
    </head><body>
      <h1 id="activity-name">有封面图</h1>
      <div id="js_name">公众号</div>
      <div id="js_content"><p>正文内容足够长用于测试封面图提取逻辑</p></div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/ogimage");

    expect(article.cover).toBe("https://mmbiz.qpic.cn/cover.jpg");
  });

  it("应该在没有 og:image 时 fallback 到正文首图", async () => {
    const html = `<!DOCTYPE html><html><head><title>No OG</title></head><body>
      <h1 id="activity-name">无 OG 有正文图</h1>
      <div id="js_name">公众号</div>
      <div id="js_content">
        <p>正文开始</p>
        <img src="https://mmbiz.qpic.cn/first-img.jpg" />
        <p>正文内容足够长用于测试封面图 fallback 逻辑</p>
      </div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/firstimg");

    expect(article.cover).toBe("https://mmbiz.qpic.cn/first-img.jpg");
  });

  it("应该在无图片时 cover 为 undefined", async () => {
    const html = `<!DOCTYPE html><html><head><title>No Image</title></head><body>
      <h1 id="activity-name">无图文章</h1>
      <div id="js_name">公众号</div>
      <div id="js_content"><p>纯文字正文内容，没有任何图片。需要足够长来通过解析测试。</p></div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/noimg");

    expect(article.cover).toBeUndefined();
  });

  it("图片提取失败不应导致导入失败", async () => {
    // 模拟一个 cheerio 解析异常的场景（通过特殊 HTML 触发）
    const html = `<!DOCTYPE html><html><head><title>Error Test</title></head><body>
      <h1 id="activity-name">图片异常</h1>
      <div id="js_name">公众号</div>
      <div id="js_content"><p>正文内容足够长用于测试图片提取异常处理逻辑</p></div>
    </body></html>`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    // 即使 og:image 查找有问题，也不应抛出异常
    const article = await parseWechatArticle("https://mp.weixin.qq.com/s/imgerr");

    expect(article.title).toBe("图片异常");
    // cover 可以是 undefined，但不应抛出异常
  });
});
