import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleContentRenderer, insertAnnotationsIntoHtml } from "../ArticleContentRenderer";

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

  // ---- 批注（annotation）回归测试：覆盖「只渲染一处高亮」+「悬浮无 tooltip」两个根因 ----

  it("命中与正文空白/换行不一致的批注（空白归一化匹配）", () => {
    // 正文里 "拥堵，\n\n当地管理处" 有换行；批注 selectedText 为去换行版本 —— 既单节点 indexOf 必失败。
    const html = "<p>西湖孤山路旁长椅因打卡人流扎堆引发排队拥堵，</p><p>当地管理处试行“限时拍摄”，受到支持。</p>";
    const out = insertAnnotationsIntoHtml(html, [
      {
        id: "ann-1",
        selectedText: "拥堵，当地管理处试行",
        comment: "治理案例",
        color: "#facc15",
        startOffset: null,
      },
    ]);
    expect(out).toContain("data-annotation-id=\"ann-1\"");
    // 跨 <p> 被切成两段，每段各包一个 mark，共享同一 id
    const matches = out.match(/data-annotation-id="ann-1"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("渲染 HTML 正文时，鼠标进入 mark 触发 onAnnotationHover（携带完整批注）", () => {
    const onHover = vi.fn();
    render(
      <ArticleContentRenderer
        rawHtml="<p>有些风景，适合远望。</p>"
        annotations={[
          { id: "ann-2", selectedText: "有些风景，适合远望。", comment: "金句批注", color: "#facc15", startOffset: null, endOffset: null },
        ]}
        onAnnotationHover={onHover}
      />
    );
    const content = screen.getByTestId("article-content");
    const mark = content.querySelector("mark[data-annotation-id='ann-2']");
    expect(mark).not.toBeNull();
    fireEvent.mouseMove(mark!, { clientX: 10, clientY: 10 });
    expect(onHover).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ann-2", comment: "金句批注" })
    );
  });

  it("鼠标移出 mark / 正文区域时上报 null", () => {
    const onHover = vi.fn();
    const { container } = render(
      <ArticleContentRenderer
        rawHtml="<p>有些风景，适合远望。</p>"
        annotations={[
          { id: "ann-3", selectedText: "有些风景，适合远望。", comment: "c", color: "#facc15", startOffset: null, endOffset: null },
        ]}
        onAnnotationHover={onHover}
      />
    );
    const wrapper = container.querySelector('[data-testid="article-content"]') as HTMLElement;
    fireEvent.mouseMove(wrapper.querySelector("mark")!, { clientX: 5, clientY: 5 });
    fireEvent.mouseLeave(wrapper);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("无 rawHtml 的纯文本文章同样注入批注高亮", () => {
    render(
      <ArticleContentRenderer
        fullText="第一段内容，这是金句。\n\n第二段普通文本。"
        annotations={[
          { id: "ann-4", selectedText: "第一段内容，这是金句。", comment: "批注4", color: "#facc15", startOffset: null, endOffset: null },
        ]}
      />
    );
    const content = screen.getByTestId("article-content");
    const mark = content.querySelector("mark[data-annotation-id='ann-4']");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toContain("第一段内容，这是金句。");
  });
});
