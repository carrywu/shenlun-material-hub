# 文章导出功能开发交接报告（Issue #7）

> 本文档供**下一个接手 agent** 快速了解文章导出功能的现状、架构、验证状态与可继续的工作。
> 开发指令书（需求来源）：`docs/agent/article-export-development-prompt.md`
> 项目交接文档：`docs/audit/development-handoff.md`（末尾"文章导出 PDF / Word"章节）、`docs/audit/development-todolist.md`（Stage 15）

---

## 1. 任务与状态

- **Issue**：`#7 新增文章导出 PDF / Word（带批注版与无批注版）`
- **分支**：`feat/article-export-pdf-word`（基于 `main`，**尚未合并**）
- **提交**：5 个 commit（见末尾"Git 提交"）
- **实现范围**：文章详情页顶部"导出"下拉菜单，4 种导出：
  - PDF（无批注 / 带批注）
  - Word `.docx`（无批注 / 带批注）
- **第一版只支持单篇导出**（批量导出按指令书要求第一版不做）。

**状态：核心功能已完成，lint/test/build/导出专项 E2E 全绿。** 剩余为"补全 E2E 覆盖 + 手工验证 + 排版打磨"（见 §5）。

---

## 2. 架构概览

```
src/lib/article-export/                  # 纯逻辑层（可单测，无 React）
  types.ts                  # 统一中间结构 ExportContent / ExportBlock / ExportAnnotation
  filename.ts               # 安全文件名（非法字符/截断/兜底/扩展名）
  build-export-content.ts   # rawHtml/fullText -> ExportBlock（复用 sanitizeArticleHtml）
  build-annotated-content.ts# 【核心】批注编号算法：按正文位置排序 + [1][2] + 未定位归文末
  download-file.ts          # file-saver 下载包装
  image-loader.ts           # 图片超时/单图失败降级/累计预算
  build-docx.ts             # ExportContent -> 真实 .docx Blob（docx 库）

src/components/articles/
  ArticlePrintableContent.tsx  # A4 打印专用布局（clean 无 mark / annotated 含编号+文末批注）
  ArticleExportMenu.tsx        # 导出下拉菜单（4 选项 + 稳定 testid + aria + 键盘 + 共享 pending）

src/app/articles/[id]/page.tsx # 工具栏接入导出菜单（仅 +5 行：import + relative wrapper + <ArticleExportMenu>）

e2e/article-export.spec.ts     # 导出 E2E（8 条）
```

---

## 3. 关键技术决策（不要推翻，除非有明确理由）

| 维度 | 决策 | 原因 |
|------|------|------|
| **PDF** | `react-to-print` v3 → 浏览器原生打印窗口 → 用户"另存为 PDF" | 指令书**禁止服务端 Chromium**；html2canvas 中文渲染质量差 |
| **Word** | `docx` v9 生成**真实 .docx**（Document/Paragraph/TextRun/ImageRun） | 指令书**禁止 HTML 伪装 .docx / .doc / html-docx-js** |
| **批注编号** | 按正文**首次出现位置**排序，**不按 createdAt** | 指令书 §3.5 硬要求；PDF 与 Word **共用一套算法** |
| **正文清洗** | 复用 `ArticleContentRenderer.tsx` 的 `sanitizeArticleHtml` | 指令书**禁止复制漂移的清洗逻辑** |
| **权限** | **零改动** | 指令书只消费详情接口已返回的批注（`route.ts:28-62` 非 ADMIN 已过滤他人批注 + 防御性二次过滤） |
| **下载** | `file-saver`（saveAs） | 用户已选；原生 Blob 也可，但 file-saver 跨浏览器更稳 |

---

## 4. 验证状态（执行日期 2026-06-20）

| 命令 | 结果 |
|------|------|
| `pnpm lint` | **0 errors**（70 pre-existing warnings，非本任务引入） |
| `pnpm test` | **85 files / 816 passed**（基线 77/761，新增 8 文件 55 测试，无回归） |
| `pnpm build` | **Compiled successfully, 91/91 static pages** |
| `pnpm exec playwright test e2e/article-export.spec.ts --project=admin --workers=1` | **8 passed / 0 flaky**（49.2s） |

**标准验证**（项目 CLAUDE.md）：
```bash
pnpm lint && pnpm test && pnpm build
pnpm exec playwright test e2e/article-export.spec.ts --project=admin --workers=1
```

---

## 5. 下一个 agent 可继续做的事（明确清单，按优先级）

### A. 补全 E2E 覆盖（指令书列 17 条，已稳定自动化 8 条）

当前 `e2e/article-export.spec.ts` 已覆盖：菜单可见/4选项/testid、键盘+aria、Word 两种下载断言（含项目首个 `expect(download)`）、无批注降级、PDF 打印根 DOM（clean 无批注章节）、防重复点击、失败恢复。

**可补的**（其余几条转入了组件单测或留手工）：
1. **E2E 层"空正文禁用"**：当前在 Vitest 组件单测验证（`ArticleExportMenu.test.tsx`）。可在 E2E 用一篇空正文文章（或 mock）验证 trigger disabled。需要 seed 一篇空正文文章——`e2e/helpers/seed.ts` 的 `ensureArticleExists` 取的是已有文章，可能需扩展。
2. **注入批注后验证 PDF 打印区**：当前 `build-annotated-content` 的编号/未定位逻辑由 11 条 Vitest 覆盖，组件层 `ArticlePrintableContent` 的 mark/编号/文末章节由 4 条组件单测覆盖。E2E 层可通过 `POST /api/content-items/[id]/annotations`（admin storageState）给 seed 文章注入一条批注，再触发 PDF，断言打印根含 `[1]` 和"文章批注"。
3. **图片存在于打印区**：seed 一篇带图文章，验证打印根含 `<img>`。

### B. PDF 排版手工验证 + 打磨

浏览器原生打印弹窗无法自动化（指令书已预见，要求"拆组件边界 + 验证打印 DOM + 手工验证系统打印窗口"）。需手工：
1. 触发 PDF → 打印窗口 → "另存为 PDF" → 检查 **A4 / 中文字体（PingFang/YaHei 系统栈）/ 标题不与正文粘连 / 段落行距 / 图片最大宽 / 跨页断裂**（`@media print` 已在 `ArticlePrintableContent.tsx` 内联 `@page { size: A4; margin: 18mm 16mm }` + `break-inside: avoid`）。
2. 不打印导航/按钮/侧栏/Toast——已通过把打印根放在 `position:absolute; left:-99999px` 的独立容器 + 仅渲染导出字段实现。

### C. Word 真实图片抽查

单测用 1×1 PNG 验证 ImageRun 嵌入路径。真实微信图片经 `/api/proxy/image` 下载嵌入需手工抽查（Word/WPS 打开确认图片在位）。

### D. 全量 5-project E2E 回归

当前只跑导出专项（admin project）+ standard 全量（lint/test/build）。全量 `pnpm exec playwright test`（5 project × ~2115 用例，约 1.7h）未跑。**注意**：项目历史有长跑 flaky（见 memory `full-run-class-d-test-regression` 与 handoff §11），全量失败若是已知环境性 flaky 非本任务回归。

### E. 后续：批量导出

指令书明确第一版不做列表页批量导出。如要做，需新增列表页多选 + 循环调用现有单篇导出逻辑。

---

## 6. 关键文件索引

| 文件 | 作用 |
|------|------|
| `src/lib/article-export/types.ts` | 统一中间结构（ExportContent / ExportBlock / ExportAnnotation / ExportAnnotationInput） |
| `src/lib/article-export/build-annotated-content.ts` | **核心**：批注编号算法（归一化匹配 + 按位置排序 + 未定位归文末） |
| `src/lib/article-export/build-export-content.ts` | 正文转换，复用 `sanitizeArticleHtml` |
| `src/lib/article-export/build-docx.ts` | Word 生成；`mapContentTypeToDocx` 把 content-type 映射到 docx 类型 |
| `src/lib/article-export/image-loader.ts` | 限制常量 + `fetchImageBytes` + `waitForImages` + `shouldDowngradeImage` |
| `src/lib/article-export/filename.ts` | `buildExportFilename(title, format, variant)` |
| `src/components/articles/ArticleExportMenu.tsx` | 导出菜单 + react-to-print 接入 + docx 导出编排 |
| `src/components/articles/ArticlePrintableContent.tsx` | 打印布局 + A4 `@media print` 样式 |
| `e2e/article-export.spec.ts` | 导出 E2E |
| `src/components/articles/ArticleContentRenderer.tsx` | 复用源：`sanitizeArticleHtml` + `insertAnnotationsIntoHtml`（批注匹配思路来源） |

---

## 7. 已知坑 / 约束（接手前必读）

1. **react-to-print v3 API 变了**：只有 `useReactToPrint` hook（**没有**旧版 `<ReactToPrint>` 组件或 `trigger`）。签名：`useReactToPrint({ contentRef, documentTitle, pageStyle, onBeforePrint, onPrintError, onAfterPrint })` 返回 `handlePrint()`。print 内容通过 `contentRef` 指向的 DOM 节点快照。
2. **docx v9 ImageRun 只支持 jpg/png/gif/bmp**——**不支持 webp/svg**。webp 等会在 `mapContentTypeToDocx` 返回 null → 降级 `[图片加载失败]` 占位（这是符合指令书"不因 WebP 让整篇失败"的设计）。
3. **`printable-root` 故意 hidden**：打印根容器 `position:absolute; left:-99999px; width:0;height:0;overflow:hidden`。**E2E 不能用 `toBeVisible`**（会判 hidden），用 `toHaveCount(1)` + `textContent()` 断言。
4. **批注防重叠只挡"部分重叠"**：`findFirstFreeOccurrence` 允许**完全相等**的区间叠加（同文本多批注 → `[1][2]`），只挡部分重叠。这是指令书 §3.5 要求，**不要改回"全部重叠都挡"**，否则 `[1][2]` 会失效。
5. **`sanitizeArticleHtml` 有 SSR 分支**：`if (typeof window === "undefined") return clean;`——SSR 下只做 DOMPurify 不做图片代理。Vitest jsdom 环境有 `window`，走完整分支。
6. **导出菜单定位**：菜单是 `absolute`，接入处包了 `<div className="relative">`。若改工具栏布局，注意这个 relative wrapper 不能丢。
7. **pending 状态**：Word 导出无图片时极快，pending 窗口很短——E2E 断言 pending 不要用 `toBeDisabled` 抓时序，改用下载计数。
8. **图片限制阈值**（指令书要求写明）：单图 3MB / 累计 15MB / 单图超时 8s（针对 2 核共享主机保守取值）。

---

## 8. 手工验证步骤

1. 登录 → 进任一文章详情页 → 顶部应见"导出"按钮。
2. 点"导出" → 下拉含 PDF/Word × 无批注/带批注 4 项。
3. **Word 无批注/带批注** → 触发 `.docx` 下载，文件名 `{标题}_{无批注|带批注}.docx`，Word/WPS 能打开。
4. **PDF 无批注** → 弹浏览器打印窗口 → 选"另存为 PDF" → 确认 A4、中文字体正常、无批注痕迹。
5. **PDF 带批注**（对有批注的文章）→ 打印窗口预览正文有 `[n]` 编号 + 文末"文章批注"章节。
6. **无批注文章选带批注版** → 应见 toast"该文章暂无批注，将按不带批注版导出"且仍导出。

---

## 9. Git 提交（分支 `feat/article-export-pdf-word`）

```
4b5caba feat(export): add shared article export content model and pure logic
86001b0 feat(export): add docx article generation
14c6e64 feat(export): add export menu, print view, and detail page wiring
581626c test(export): add article export playwright coverage
074f75d docs(export): update handoff and todolist
```

合并建议：本分支基于最新 `main`，可直接 PR 合并（无冲突）。合并前建议跑一次 §4 的标准验证。
