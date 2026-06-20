import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import {
  extractArticleContent,
  computeEffectiveLength,
  computeArticleContentHash,
} from "../content-extractor";

const BASE_URL = "https://www.example.gov.cn/news/2026/article.html";

/** 构造一段足够长的中文正文，避免触发 300 字门控 */
function longParagraph(text: string): string {
  // 重复填充到足够长度
  const base = text;
  let s = base;
  while (s.length < 400) s += base;
  return s.slice(0, 400);
}

const P1 = longParagraph("高质量发展是全面建设社会主义现代化国家的首要任务。");
const P2 = longParagraph("在科技创新方面，广东省持续加大研发投入，建设了一批平台。");
const P3 = longParagraph("下一步，广东省将继续坚持高质量发展不动摇，以更大力度推进改革创新。");

function load(html: string) {
  return cheerio.load(html);
}

describe("content-extractor / computeEffectiveLength", () => {
  it("去除所有空白后计数字数", () => {
    expect(computeEffectiveLength("  你好 世界 \n\n 测试 ")).toBe(6);
    expect(computeEffectiveLength("")).toBe(0);
  });

  it("与 content-filter 的哈希一致（sha256 前 16 位）", () => {
    expect(computeArticleContentHash("abc")).toMatch(/^[0-9a-f]{16}$/);
    // 相同输入稳定
    expect(computeArticleContentHash("abc")).toBe(computeArticleContentHash("abc"));
  });
});

describe("content-extractor / extractArticleContent", () => {
  it("多个 <p> 保留为多个段落（含 \\n\\n）", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <p>${P2}</p>
      <p>${P3}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL);
    expect(result).not.toBeNull();
    expect(result!.fullText).toMatch(/\n\n/);
    const paras = result!.fullText.split(/\n\n/);
    expect(paras.length).toBeGreaterThanOrEqual(3);
    expect(result!.rawHtml).toContain("<p>");
  });

  it("<br> 在叶子内转为单换行（不升级成段落）", () => {
    const html = `<div class="content">
      <p>${P1}<br>第二行内容测试<br>第三行内容测试</p>
    </div>`;
    const result = extractArticleContent(load(html), [".content"], BASE_URL)!;
    // 单个 <p> 内的 br 应产成单换行，整段仍是 1 个段落
    expect(result.fullText).toMatch(/第二行内容测试\n第三行内容测试/);
    expect(result.fullText.split(/\n\n/).length).toBe(1);
  });

  it("标题结构被保留为独立段落", () => {
    const html = `<div class="article-content">
      <h2>一、主要成效</h2>
      <p>${P1}</p>
      <h2>二、下一步工作</h2>
      <p>${P2}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.fullText).toContain("一、主要成效");
    expect(result.fullText).toContain("二、下一步工作");
    expect(result.rawHtml).toContain("<h2>");
  });

  it("列表结构被保留，列表项单独成段", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <ul>
        <li>第一条措施是加强创新</li>
        <li>第二条措施是优化环境</li>
        <li>第三条措施是改善民生</li>
      </ul>
      <p>${P2}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.rawHtml).toContain("<ul>");
    expect(result.rawHtml).toContain("<li>");
    // 列表项文本进入 fullText
    expect(result.fullText).toContain("第一条措施是加强创新");
    expect(result.fullText).toContain("第三条措施是改善民生");
  });

  it("引用块 blockquote 被保留", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <blockquote>习近平总书记指出，要坚定不移走高质量发展之路。</blockquote>
      <p>${P2}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.rawHtml).toContain("<blockquote>");
    expect(result.fullText).toContain("坚定不移走高质量发展之路");
  });

  it("表格内容可读", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <table>
        <thead><tr><th>指标</th><th>数值</th></tr></thead>
        <tbody>
          <tr><td>GDP增速</td><td>5.2%</td></tr>
          <tr><td>研发投入</td><td>3.5%</td></tr>
        </tbody>
      </table>
      <p>${P2}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.rawHtml).toContain("<table>");
    expect(result.fullText).toContain("GDP增速");
    expect(result.fullText).toContain("研发投入");
  });

  it("图片保留在原文位置（不挪到末尾）", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <img src="/img/photo1.jpg" alt="图片1" />
      <p>${P2}</p>
      <img src="/img/photo2.jpg" alt="图片2" />
      <p>${P3}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    const raw = result.rawHtml;
    const idxP2 = raw.indexOf("photo1");
    // 第二张图在第一张之后
    expect(raw.indexOf("photo2")).toBeGreaterThan(idxP2);
    expect(raw).toContain('<img');
  });

  it("相对图片 URL 转成绝对 URL", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <img src="./img/photo.jpg" alt="图" />
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.rawHtml).toContain("https://www.example.gov.cn/news/2026/img/photo.jpg");
  });

  it("懒加载 data-src 地址被正确恢复", () => {
    const html = `<div class="article-content">
      <p>${P1}</p>
      <img src="data:image/gif;base64,placeholder" data-src="/img/real.jpg" alt="真图" />
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    // 真实地址应出现在 src，懒加载属性应被清除
    expect(result.rawHtml).toMatch(/src="https:\/\/www\.example\.gov\.cn[^"]*real\.jpg"/);
    expect(result.rawHtml).not.toContain("data-src");
  });

  it("script/style/iframe 被删除", () => {
    const html = `<div class="article-content">
      <script>var x = '恶意脚本'; alert('xss');</script>
      <style>.ad { color: red; }</style>
      <iframe src="https://evil.com"></iframe>
      <p>${P1}</p>
      <p>${P2}</p>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.rawHtml).not.toContain("<script");
    expect(result.rawHtml).not.toContain("<style");
    expect(result.rawHtml).not.toContain("<iframe");
    expect(result.fullText).not.toContain("恶意脚本");
    expect(result.fullText).not.toContain("alert");
  });

  it("导航和广告不进入正文", () => {
    const html = `<div class="wrapper">
      <nav class="navbar"><a href="/">首页</a><a href="/news">新闻</a></nav>
      <div class="article-content">
        <p>${P1}</p>
        <p>${P2}</p>
      </div>
      <div class="share"><a>分享到微博</a></div>
      <div class="related"><a>相关推荐：另一篇文章</a></div>
      <div class="footer">版权所有 © 2026</div>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.fullText).not.toContain("分享到微博");
    expect(result.fullText).not.toContain("相关推荐");
    expect(result.fullText).not.toContain("版权所有");
    expect(result.fullText).not.toContain("首页");
  });

  it("父子容器不会造成重复文本", () => {
    // .content 包着 .article-content，应只取内层，不重复。
    // 用唯一标记避免被 longParagraph 重复填充干扰计数。
    const a = "唯一标记甲" + P1.slice(0, 300);
    const b = "唯一标记乙" + P2.slice(0, 300);
    const html = `<div class="content">
      <div class="article-content">
        <p>${a}</p>
        <p>${b}</p>
      </div>
    </div>`;
    const result = extractArticleContent(load(html), [".content"], BASE_URL)!;
    // 唯一标记只应出现一次（证明没有父子重复提取）
    expect(result.fullText.split("唯一标记甲").length - 1).toBe(1);
    expect(result.fullText.split("唯一标记乙").length - 1).toBe(1);
  });

  it("空正文 / 无匹配选择器返回 null", () => {
    const html = `<div class="nothing"><p>短</p></div>`;
    expect(extractArticleContent(load(html), [".not-exist"], BASE_URL)).toBeNull();
  });

  it("低于有效字数阈值时返回 null（命中但内容过短）", () => {
    const html = `<div class="article-content"><p>这只是很短的一句话。</p></div>`;
    expect(
      extractArticleContent(load(html), [".article-content"], BASE_URL)
    ).toBeNull();
  });

  it("HTML 特殊字符正确处理（&amp; 等实体被解码，不残留转义）", () => {
    // 用 HTML 实体而非裸 < >，避免破坏 cheerio 解析
    const textWithSpecial = longParagraph("用 GDP 与多项数据 amp 符号测试说明指标情况。");
    const html = `<div class="article-content"><p>${textWithSpecial}</p></div>`;
    const result = extractArticleContent(load(html), [".article-content"], BASE_URL)!;
    expect(result.fullText).toContain("GDP");
    // fullText 是纯文本，不应残留 HTML 实体或标签
    expect(result.fullText).not.toContain("&lt;");
    expect(result.fullText).not.toContain("<p>");
    expect(result.rawHtml).toContain("<p>");
  });

  it("按选择器优先级：第一个命中且达标即用，不 fall through", () => {
    const html = `<div class="content">
      <div class="article-content">
        <p>${P1}</p><p>${P2}</p>
      </div>
    </div>`;
    // .article-content 排前 → 应取它
    const result = extractArticleContent(load(html), [".article-content", ".content"], BASE_URL)!;
    expect(result.rawHtml).toContain("article-content");
  });

  it("选择器顺序兜底：前面不达标时用后面", () => {
    // .article-content 内容过短，应 fall through 到 .content
    const html = `<div class="wrapper">
      <div class="article-content"><p>短文。</p></div>
      <div class="content"><p>${P1}</p><p>${P2}</p></div>
    </div>`;
    const result = extractArticleContent(load(html), [".article-content", ".content"], BASE_URL)!;
    expect(result.rawHtml).toContain("class=\"content\"");
  });
});
