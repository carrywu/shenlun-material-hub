# 前端改造设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分两轮完成前端改造——第一轮补全功能缺口（A），第二轮统一 UI 组件（B），使前端达到功能完整 + 视觉一致的生产就绪状态。

**Architecture:** 第一轮 5 项功能任务独立可测试，基于现有 shadcn/Tailwind/lucide 技术栈增量开发。第二轮 4 阶段渐进式 UI 统一，不引入新框架。两轮之间以 lint/test/build 全量验证为门禁。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 6 / Tailwind CSS v4 / shadcn/ui (base-nova, @base-ui/react) / lucide-react / sonner / zod (评估中)

---

## 第一轮：功能补全（A 类）

### A1：学习状态展示标记

**目标：** 文章列表和卡片列表项展示 per-user 学习状态（已读/已收藏/已忽略）。

**数据来源：** API 已返回 `userRead`、`userIgnored`、`userBookmarked` 布尔字段。
- `GET /api/articles` → 每个 article 包含 `userRead`、`userIgnored`、`userBookmarked`
- `GET /api/content-items/[id]` → 包含 `userRead`、`userIgnored`、`userBookmarked`

**涉及文件：**
- `src/app/articles/page.tsx` — 文章列表项添加状态标记
- `src/components/articles/ArticlesPage.tsx` — 列表组件层添加状态标记
- `src/app/cards/page.tsx` — 卡片列表（素材卡无 userRead 但可展示 bookmarked）
- `src/components/ArticleDetail.tsx` — 文章详情标题区域展示状态

**UI 表现：**
- 已读：灰色 `CheckCircle` 图标 + "已读" 文字，使用 shadcn Badge variant="secondary"
- 已收藏：`Bookmark` 图标填充色（lucide `BookmarkCheck`），使用 shadcn Badge variant="outline"
- 已忽略：半透明度 + `EyeOff` 图标，使用 shadcn Badge variant="secondary" + `opacity-50`

**约束：**
- 只做展示标记，不加"标为已读/忽略/收藏"操作按钮
- 不新增 API 调用，只消费已有返回字段
- 不影响现有排序/过滤逻辑

**验证：**
- `pnpm lint && pnpm test && pnpm build`
- 文章列表项可见状态标记（需有测试数据）

---

### A2：Articles 页面 Tab 切换

**目标：** `/articles` 提供全部/推荐/收藏三个 Tab，统一文章入口。

**涉及文件：**
- `src/app/articles/page.tsx` — 页面入口
- `src/components/articles/ArticlesPage.tsx` — 主组件，添加 Tabs 逻辑
- `src/app/api/articles/route.ts` — 支持 `filter=approved` 和 `filter=favorites` 查询参数

**Tab 定义：**
| Tab | 数据源 | API 参数 |
|-----|--------|----------|
| 全部 | 所有可见文章（默认） | 无额外参数 |
| 推荐 | `adminReviewStatus === 'approved'` | `?filter=approved` |
| 收藏 | 用户收藏的文章 | `?filter=favorites`（联表 ArticleFavorite） |

**UI 实现：**
- 使用 shadcn `Tabs` 组件（已安装）
- Tab 切换时重新请求 API（不缓存）
- 每个 Tab 下复用现有文章列表渲染逻辑
- 空状态：各 Tab 独立 EmptyState（"暂无推荐文章"/"暂无收藏文章"）

**API 变更：**
- `GET /api/articles` 新增可选参数 `filter`：
  - `approved`：`where.adminReviewStatus = 'approved'`
  - `favorites`：联表 `ArticleFavorite` 查 `userId` 匹配的文章
  - 空/其他：不过滤（保持现有行为）

**验证：**
- `pnpm test src/app/api/articles/__tests__/route.test.ts`（补充 filter 参数测试）
- `pnpm lint && pnpm test && pnpm build`

---

### A3：旧路由清理

**目标：** 删除 `/discover`、`/explore`、`/my-articles` 三个旧路由的全部文件。

**涉及文件（删除）：**
- `src/app/discover/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/my-articles/page.tsx`
- `src/components/my-articles/MyArticlesPage.tsx`

**涉及文件（检查/清理引用）：**
- `src/components/ArticleChecklist.tsx` — 可能引用旧路由
- `src/components/RootNav.tsx` — Batch 4 已清理导航，确认无残留
- `src/app/page.tsx` — Batch 4 已清理快捷操作，确认无残留
- `src/proxy.ts` — Batch 4 已移除旧 public 路由，确认无残留
- `e2e/` — 检查是否有指向旧路由的 E2E 测试需要删除或更新

**约束：**
- 不保留重定向（需求文档已确认）
- 删除前先 grep 全项目确认无其他引用
- 如有共享组件只被旧路由使用，一并删除

**验证：**
- 删除后 `pnpm build` 无错误
- 无 dead import 或 unused export

---

### A4：归档箱 Tab

**目标：** `/cards` 页面添加"已归档" Tab，用户可查看和恢复已归档素材卡。

**涉及文件：**
- `src/app/cards/page.tsx` — 添加 Tabs
- `src/app/api/material-cards/route.ts` — 支持 `?includeArchived=true` 参数

**Tab 定义：**
| Tab | 数据源 | API 参数 |
|-----|--------|----------|
| 全部卡片 | `archivedAt: null`（默认） | 无额外参数 |
| 已归档 | `archivedAt` 非 null | `?archivedOnly=true` |

**UI 实现：**
- 使用 shadcn `Tabs` 组件
- "全部卡片" Tab：现有卡片列表，无变化
- "已归档" Tab：
  - 卡片显示归档时间（`archivedAt` 格式化为相对时间）
  - 每张卡片有"恢复"按钮（调用 `PATCH /api/material-cards/[id]`，body: `{ action: "unarchive" }`）
  - 恢复后自动刷新列表
  - 空状态："没有已归档的卡片"

**API 变更：**
- `GET /api/material-cards` 新增可选参数 `archivedOnly`：
  - `true`：只返回 `archivedAt` 非 null 的记录
  - 不传或 `false`：保持现有行为（只返回 `archivedAt: null`）

**验证：**
- `pnpm test src/app/api/material-cards/__tests__/route.test.ts`（补充 filter 参数测试）
- `pnpm lint && pnpm test && pnpm build`

---

### A5：重新生成确认弹窗

**目标：** 用户点击"重新生成"时弹出二次确认，确认后传 `force: true`。

**涉及文件：**
**触发入口：** `src/app/articles/[id]/page.tsx` 文章详情页底部的"生成素材卡"按钮。当该文章已有关联素材卡时，按钮文案变为"重新生成"，点击触发确认弹窗。
- 新建或复用 shadcn `AlertDialog`

**UI 实现：**
- 使用 shadcn `AlertDialog` 组件（需安装，`ui/alert-dialog.tsx`）
- 标题："确认重新生成"
- 内容："该文章已有素材卡，重新生成将覆盖现有内容并重置学习状态。是否继续？"
- 确认按钮："重新生成"（destructive variant）
- 取消按钮："取消"
- 确认后调用 `POST /api/content-items/[id]/generate-card`，body 包含 `{ force: true }`
- 生成中显示 loading 状态，完成后 toast 提示并刷新

**约束：**
- 只在已有卡片时弹出确认框；首次生成（无已有卡）直接执行
- 前端需先检查是否存在已有卡（可从页面 state 或 API 判断）

**验证：**
- `pnpm lint && pnpm test && pnpm build`

---

## 第二轮：UI 组件统一（B 类）

### B-Phase 1：基础组件加固

**目标：** 补全缺失的基础组件，统一按钮/Input 使用。

**新建组件：**
- `src/components/ui/empty-state.tsx` — 空状态组件（图标 + 标题 + 描述 + 操作按钮）
- `src/components/ui/loading-skeleton.tsx` — 加载骨架屏（基于 Tailwind animate-pulse）
- `src/components/ui/error-boundary.tsx` — React Error Boundary class component + fallback UI

**迁移任务：**
- 31 个裸 `<button>` → shadcn Button（17 个文件）
- 25 个裸 `<input>` → shadcn Input（10 个文件）
- 3 个裸 `<select>` → shadcn Select（3 个文件）

**补全任务：**
- 所有列表页补 LoadingSkeleton（articles, cards, search, review, admin 列表）
- 所有列表页补 EmptyState
- layout.tsx 添加顶层 ErrorBoundary

**验证：** `pnpm lint && pnpm test && pnpm build`

---

### B-Phase 2：表单规范化

**目标：** 统一表单组件样式和结构。

**新建组件：**
- `src/components/ui/form-field.tsx` — FormField 封装（label + input + error + helper）

**迁移任务：**
- `src/app/login/page.tsx` — 裸 input → shadcn Input + FormField
- `src/app/register/page.tsx` — 同上
- `src/app/admin/login/page.tsx` — 同上
- `src/app/admin/users/page.tsx` — 创建用户/重置密码表单

**Zod 评估：**
- 当前表单数量少（~6 个），手写 validation 可维护
- 如引入 Zod：从 devDependencies 移到 dependencies，创建共享 schema 文件
- 决策点：Phase 2 完成时评估，如果手写 validation 仍然可控则不引入

**验证：** `pnpm lint && pnpm test && pnpm build`

---

### B-Phase 3：表格与弹窗统一

**目标：** 消除原生 table 和手写弹窗。

**迁移任务（表格）：**
- `src/app/admin/page.tsx` — 原生 table → shadcn Table
- `src/app/admin/users/page.tsx` — 同上
- 其他 admin 列表页如使用原生 table，一并迁移

**迁移任务（弹窗）：**
- `src/app/admin/users/page.tsx` — 创建用户弹窗 → shadcn Dialog
- `src/app/admin/users/page.tsx` — 重置密码弹窗 → shadcn Dialog
- `src/app/articles/[id]/page.tsx` — 手写弹窗 → shadcn Dialog
- `src/components/UpgradeButton.tsx` — 手写弹窗 → shadcn Dialog

**验证：** `pnpm lint && pnpm test && pnpm build`

---

### B-Phase 4：视觉统一

**目标：** 消除视觉不一致，统一页面结构。

**新建组件：**
- `src/components/ui/page-header.tsx` — PageHeader（标题 + 描述 + 操作区域）

**统一任务：**
- 卡片圆角统一为 `rounded-lg`（消除 `rounded-xl` / `rounded-md` 混用）
- 所有页面标题区域使用 PageHeader 组件
- 标准化 empty state 文案（每个空状态引导用户下一步操作）

**验证：** `pnpm lint && pnpm test && pnpm build`

---

## 执行约束

1. **两轮制：** A 全做完验证通过后再启动 B。
2. **小步提交：** 每个 A 项 / B-Phase 内每个可独立验证的变更建议单独 commit。
3. **验证门禁：** 每项完成后跑 `pnpm lint && pnpm test && pnpm build`。
4. **不引入新框架：** 不引入 AntD、Arco、MUI、HeroUI、NaiveUI、Element Plus、TanStack Table、React Hook Form。
5. **不删历史数据：** 旧路由文件删除前 grep 确认无引用，不保留重定向。
6. **所有 UI 文案中文。**
7. **E2E 更新：** 删除旧路由后更新或删除对应的 Playwright spec。

## 不包含在本轮范围

- Prisma migration 应用（需 Docker/PostgreSQL）
- Playwright E2E 全量回归（需 Docker/PostgreSQL）
- 学习状态操作入口（"标为已读"按钮等，只做展示标记）
- PWA / 离线 / 推送
- 后台移动端完整优化（只保证基本可用）
