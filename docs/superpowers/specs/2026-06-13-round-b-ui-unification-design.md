# Round B：UI 组件统一设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一前端 UI 组件使用，消除裸 HTML 元素和手写弹窗，补全缺失的基础组件，使前端达到视觉一致的生产就绪状态。

**Architecture:** 4 阶段渐进式改造，每个 Phase 独立 commit + lint/test/build 验证门。Phase 1 创建基础组件并迁移裸元素 → Phase 2 表单规范化 → Phase 3 表格与弹窗统一 → Phase 4 视觉统一。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 6 / Tailwind CSS v4 / shadcn/ui (base-nova, @base-ui/react) / lucide-react / sonner

**前置条件：** Round A（A1-A5）已全部完成并验证通过（55 files / 386 tests / lint 0 errors / build pass）。

---

## 审计修正（Round A 后重新统计）

| 指标 | 原 spec 值 | 审计实际值 | 变化原因 |
|------|--------:|--------:|----------|
| raw `<button>` | 31 / 17 文件 | **30 / 16 文件** | explore/page.tsx 已在 A3 删除 |
| raw `<input>` | 25 / 10 文件 | **25 / 10 文件** | 无变化 |
| raw `<select>` | 3 / 3 文件 | **1 / 1 文件** | 原 spec 不准确，仅 admin/users 有 1 个 |
| raw `<table>` | 7 页面 | **2 / 2 文件** | admin/tasks、admin/logs 已使用 shadcn Table |
| 手写弹窗 | 5 文件 | **4 文件（3 个迁移 + 1 个保持）** | articles/[id] 图片预览弹窗不迁移 |

register/page.tsx 的 3 个 `<input>` 已迁移到 shadcn Input（仅剩 1 个 raw button 待迁移）。

---

## B-Phase 1：基础组件加固

**优先级：** P2（最高）
**预计工作量：** 4-6 小时
**涉及文件：** 约 20 个

### 1.1 新建 EmptyState 组件

**文件：** `src/components/ui/empty-state.tsx`

**接口：**
```tsx
interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}
```

**样式：** 居中布局，icon 使用 `text-muted-foreground` 48px，title `text-lg font-medium`，description `text-sm text-muted-foreground`，action 使用 shadcn Button variant="outline"。

**替换目标（7 个内联空状态）：**

| 文件 | 当前空状态文案 |
|------|---------------|
| `src/app/page.tsx` | "暂无内容" |
| `src/app/admin/users/page.tsx` | "暂无用户数据" |
| `src/components/subscriptions/SubscriptionsPage.tsx` | "暂无来源" |
| `src/components/ai/AiConfigPage.tsx` | "暂无提示词模板" |
| `src/components/ArticleDetail.tsx` | "暂无全文内容" |
| `src/components/CollectDialog.tsx` | "没有已启用的来源" |
| `src/components/articles/ArticlesPage.tsx` | "暂无符合条件的文章" |

### 1.2 新建 LoadingSkeleton 组件

**文件：** `src/components/ui/loading-skeleton.tsx`

**接口：**
```tsx
// 骨架屏模式
interface LoadingSkeletonProps {
  lines?: number  // 默认 3
  className?: string
}

// 加载指示器模式
interface LoadingIndicatorProps {
  text?: string  // 默认 "加载中..."
}
```

**实现：** 基于 Tailwind `animate-pulse` + `bg-muted` 圆角矩形。LoadingIndicator 使用 `Loader2` lucide 图标 + `animate-spin`。

**补充/升级目标：**

| 文件 | 当前状态 | 操作 |
|------|---------|------|
| `src/app/page.tsx`（首页） | 无 loading 状态 | 新增 LoadingSkeleton |
| `src/components/ai/AiConfigPage.tsx` | 纯文本 "..." | 替换为 LoadingIndicator |

其他列表页（articles、cards、search、review、subscriptions）已有 Loader2 加载状态，暂不强制替换（可后续统一）。

### 1.3 新建 ErrorBoundary 组件

**文件：** `src/components/ui/error-boundary.tsx`

**实现：** React 类组件，捕获渲染错误，显示 fallback UI（标题"页面出错了" + 错误信息 + "重试"按钮）。

**包裹位置：**
- `src/app/layout.tsx` — 顶层包裹，捕获全局渲染错误
- `src/components/admin/AdminShell.tsx` — 可选，admin 内容区域包裹

### 1.4 裸 button 迁移（30 个 / 16 文件）

全部替换为 shadcn `Button`，根据上下文选择 variant（default / outline / ghost / destructive / link）。

| 文件 | 数量 | 推荐 variant |
|------|-----:|-------------|
| `src/app/admin/users/page.tsx` | 11 | ghost（操作按钮）、outline（筛选） |
| `src/components/admin/AdminShell.tsx` | 4 | ghost |
| `src/app/admin/page.tsx` | 2 | outline |
| `src/app/login/page.tsx` | 1 | default（提交按钮，Phase 2 处理） |
| `src/app/register/page.tsx` | 1 | default（提交按钮，Phase 2 处理） |
| `src/app/admin/login/page.tsx` | 1 | default（提交按钮，Phase 2 处理） |
| `src/app/search/page.tsx` | 1 | outline |
| `src/app/articles/[id]/page.tsx` | 1 | ghost |
| `src/app/settings/ai/page.tsx` | 1 | outline |
| `src/app/settings/ima/page.tsx` | 1 | outline |
| `src/components/RootNav.tsx` | 1 | ghost |
| `src/components/ReviewCard.tsx` | 1 | ghost |
| `src/components/ArticleChecklist.tsx` | 1 | ghost |
| `src/components/articles/ArticlesPage.tsx` | 1 | ghost |
| `src/components/sync/SyncRecordsPage.tsx` | 1 | ghost |
| `src/components/ai/AiConfigPage.tsx` | 1 | outline |

**注意：** login/register/admin-login 的提交按钮在 Phase 1 仅替换为 shadcn Button，表单结构在 Phase 2 进一步规范化。

### 1.5 裸 input 迁移（25 个 / 10 文件）

全部替换为 shadcn `Input`。

| 文件 | 数量 |
|------|-----:|
| `src/app/admin/users/page.tsx` | 5 |
| `src/components/articles/ArticlesPage.tsx` | 4 |
| `src/components/ai/AiConfigPage.tsx` | 4 |
| `src/components/sync/SyncRecordsPage.tsx` | 2 |
| `src/components/filters/DateRangeFilter.tsx` | 2 |
| `src/app/login/page.tsx` | 2 |
| `src/app/admin/login/page.tsx` | 2 |
| `src/app/admin/logs/page.tsx` | 2 |
| `src/components/UpgradeButton.tsx` | 1 |
| `src/app/settings/ai/page.tsx` | 1 |

### 1.6 裸 select 迁移（1 个 / 1 文件）

- `src/app/admin/users/page.tsx`（1 个）→ shadcn Select

### 验证

- `pnpm lint && pnpm test && pnpm build`
- 全项目 grep `<button` / `<input` / `<select` 确认无遗漏（排除 `src/components/ui/`）

---

## B-Phase 2：表单规范化

**优先级：** P3
**预计工作量：** 3-4 小时
**涉及文件：** 约 5 个

### 2.1 新建 FormField 组件

**文件：** `src/components/ui/form-field.tsx`

**接口：**
```tsx
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  helper?: string
  children: ReactNode
}
```

**样式：** label 使用 `text-xs font-medium text-muted-foreground mb-1`，error 使用 `text-xs text-red-600 mt-1`，helper 使用 `text-xs text-muted-foreground mt-1`。

### 2.2 表单迁移

| 文件 | 当前状态 | 迁移内容 |
|------|---------|---------|
| `src/app/login/page.tsx` | 2 raw input + 1 raw button | FormField 包裹 + 渐变色按钮改 shadcn default + rounded-xl → rounded-md |
| `src/app/admin/login/page.tsx` | 2 raw input + 1 raw button | 同上 |
| `src/app/register/page.tsx` | 3 shadcn Input + 1 raw button | 仅 button 改 shadcn + FormField 包裹 |
| `src/app/admin/users/page.tsx` | 创建用户弹窗 + 重置密码弹窗 | 弹窗内表单使用 FormField 包裹（弹窗本身在 Phase 3 迁移为 shadcn Dialog） |

### 2.3 Zod 决策

当前约 6 个表单，手写 validation 可控。**决策：不引入 Zod。** 如后续表单数量显著增长再评估。

### 验证

- `pnpm lint && pnpm test && pnpm build`
- 登录/注册/后台登录流程手动验证（或 E2E 可用时跑 auth.spec.ts）

---

## B-Phase 3：表格与弹窗统一

**优先级：** P3
**预计工作量：** 3-5 小时
**涉及文件：** 约 5 个

### 3.1 裸 table 迁移（2 个 / 2 文件）

| 文件 | 操作 |
|------|------|
| `src/app/admin/page.tsx` | 原生 `<table>` → shadcn Table，统一表头样式（`bg-muted/50 + font-medium text-muted-foreground`）和行 hover（`hover:bg-muted/30`） |
| `src/app/admin/users/page.tsx` | 同上 |

### 3.2 手写弹窗迁移（3 个目标）

| 文件 | 弹窗类型 | 操作 |
|------|---------|------|
| `src/app/admin/users/page.tsx` | 创建用户弹窗 | `fixed inset-0 bg-black/40` → shadcn Dialog |
| `src/app/admin/users/page.tsx` | 重置密码弹窗 | 同上 |
| `src/components/UpgradeButton.tsx` | 付费弹窗 | `fixed inset-0 bg-black/50` → shadcn Dialog |

### 不迁移项

| 文件 | 弹窗类型 | 原因 |
|------|---------|------|
| `src/app/articles/[id]/page.tsx` | 图片全屏预览（`bg-black/85`） | 全屏图片预览场景，shadcn Dialog 不适合 |
| `src/components/admin/AdminShell.tsx` | 移动端侧栏遮罩（`bg-black/50 lg:hidden`） | 侧栏 overlay 而非弹窗，保持原样 |

### 验证

- `pnpm lint && pnpm test && pnpm build`
- 全项目 grep `fixed inset-0` 确认仅剩不迁移项

---

## B-Phase 4：视觉统一

**优先级：** P4
**预计工作量：** 2-3 小时
**涉及文件：** 约 10 个

### 4.1 新建 PageHeader 组件

**文件：** `src/components/ui/page-header.tsx`

**接口：**
```tsx
interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode  // 右侧操作区域
}
```

**样式：** flex 布局，左侧标题 + 描述，右侧 actions。title 使用 `text-2xl font-bold`，description 使用 `text-sm text-muted-foreground`。

**替换目标：** 前台各页面（articles、cards、search、review、settings 等）自行实现的标题区域统一使用 PageHeader。后台页面通过 AdminShell 已有统一 header，不重复替换。

### 4.2 卡片圆角统一

全项目搜索 `rounded-xl` 和 `rounded-md`（在 card 上下文中），统一为 `rounded-lg`。主要涉及使用 shadcn Card 的 21 个文件中的自定义样式覆盖。

### 4.3 空状态文案标准化

格式统一为"暂无{名词}" + 可选操作引导。确保每个 EmptyState 有明确的下一步 CTA（如"立即添加"、"去浏览"等）。

### 验证

- `pnpm lint && pnpm test && pnpm build`
- 视觉检查：390px / 768px / 1440px，light + dark mode

---

## 执行约束

1. **顺序执行：** Phase 1 → 2 → 3 → 4，每个 Phase 完成后 lint + test + build 验证门。
2. **小步提交：** 每个 Phase 一个独立 commit。
3. **分散修改：** admin/users/page.tsx 横跨 Phase 1（button/input/select）、Phase 2（表单结构）、Phase 3（table/dialog），按 Phase 分别修改。
4. **不引入新框架：** AntD、Arco、MUI、HeroUI、NaiveUI、Element Plus、TanStack Table、React Hook Form、Zod 全部不引入。
5. **所有 UI 文案中文。**
6. **E2E 顺手修：** Round B 执行过程中遇到引用已删除路由的 E2E spec，顺手清理。
7. **图片预览弹窗保持原样：** articles/[id] 的全屏图片预览（`fixed inset-0 bg-black/85`）不迁移到 shadcn Dialog。
8. **AdminShell 移动端遮罩保持原样：** 侧栏 overlay 不是弹窗，不迁移。

## 不包含在本轮范围

- Prisma migration 应用（需 Docker/PostgreSQL）
- Playwright E2E 全量回归（需 Docker/PostgreSQL）
- 学习状态操作入口（toggle 按钮从全局字段迁移到 per-user 字段）
- PWA / 离线 / 推送
- 后台移动端完整优化
- articles/[id] 图片全屏预览弹窗迁移
- AdminShell 移动端侧栏遮罩迁移
