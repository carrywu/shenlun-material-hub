import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContentRenderer } from "../ArticleContentRenderer";

describe("ArticleContentRenderer", () => {
  it("按空行把纯文本恢复为多个段落", () => {
    render(
      <ArticleContentRenderer
        fullText={"第一段内容\n\n第二段内容\n第三行仍属于第二段"}
      />
    );

    const content = screen.getByTestId("article-content");
    const paragraphs = content.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]).toHaveTextContent("第一段内容");
    expect(paragraphs[1].textContent).toBe("第二段内容\n第三行仍属于第二段");
  });

  it("保留 HTML 中的列表、表格和图片结构", () => {
    render(
      <ArticleContentRenderer
        rawHtml="<article><ul><li>第一项</li></ul><table><tbody><tr><td>表格内容</td></tr></tbody></table><img src='/images/a.png' alt='配图' /></article>"
        sourceUrl="https://example.com/news/detail"
      />
    );

    const content = screen.getByTestId("article-content");
    expect(content.querySelector("li")).toHaveTextContent("第一项");
    expect(content.querySelector("td")).toHaveTextContent("表格内容");
    expect(screen.getByAltText("配图")).toHaveAttribute("src", "https://example.com/images/a.png");
  });

  it("清理正文 HTML 中的脚本和事件属性", () => {
    render(
      <ArticleContentRenderer
        rawHtml="<p>安全正文</p><script>alert('xss')</script><img src='https://example.com/a.png' onerror='alert(1)' />"
      />
    );

    const content = screen.getByTestId("article-content");
    expect(content.querySelector("script")).toBeNull();
    expect(content.querySelector("img")).not.toHaveAttribute("onerror");
    expect(content).toHaveTextContent("安全正文");
  });

  it("微信图片使用代理地址渲染", () => {
    render(
      <ArticleContentRenderer
        platform="wechat"
        rawHtml="<p>微信正文</p><img data-src='https://mmbiz.qpic.cn/mmbiz_png/test/0?wx_fmt=png' alt='微信图' />"
      />
    );

    const img = screen.getByAltText("微信图");
    expect(img.getAttribute("src")).toMatch(/^\/api\/proxy\/image\?url=/);
  });
});
