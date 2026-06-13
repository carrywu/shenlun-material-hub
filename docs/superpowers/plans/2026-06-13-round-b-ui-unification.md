# Round B: UI 组件统一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一前端 UI 组件，消除裸 HTML 元素和手写弹窗，补全缺失的基础组件。

**Architecture:** 4 Phase 顺序执行（基础组件 → 表单 → 表格弹窗 → 视觉统一），每 Phase 独立 commit + lint/test/build 验证门。新建 5 个组件（EmptyState / LoadingSkeleton / ErrorBoundary / FormField / PageHeader），迁移 30 raw button / 25 raw input / 1 raw select / 2 raw table / 3 手写弹窗。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 6 / Tailwind CSS v4 / shadcn/ui (base-nova, @base-ui/react) / lucide-react / sonner

---

## 迁移排除项

以下 raw 元素不迁移（原因见注释）：

| 文件 | 元素 | 原因 |
|------|------|------|
| `src/app/articles/[id]/page.tsx:1108-1118` | `fixed inset-0` + raw button | 全屏图片预览，Dialog 不适合 |
| `src/components/admin/AdminShell.tsx:126` | `fixed inset-0 bg-black/50 lg:hidden` | 移动端侧栏遮罩，非弹窗 |
| `src/app/settings/ai/page.tsx:213-221` | `<input type="range">` | 温度滑块，保留原生 range |
| `src/components/articles/ArticlesPage.tsx:765,783,803,821` | `<input type="date" className="opacity-0">` | 隐藏日期选择器叠加在 styled div 上，刻意利用原生 date picker |
| `src/components/sync/SyncRecordsPage.tsx:253,271` | `<input type="date" className="opacity-0">` | 同上日期选择器模式 |
| `src/components/filters/DateRangeFilter.tsx:51,58` | `<input type="date">` | 同上日期选择器模式 |
| `src/app/admin/logs/page.tsx:194,201` | `<input type="date">` | 同上日期选择器模式 |

日期选择器共 10 个 raw `<input type="date">`，均为刻意设计（隐藏原生 input 叠加在自定义样式 div 上获取原生 date picker），shadcn 无内置 DatePicker，保留不迁移。

排除后实际迁移量：30 raw button（16 文件）、15 raw input（6 文件）、1 raw select（1 文件）、2 raw table（2 文件）、3 手写弹窗（2 文件）。

---

## Task 1: EmptyState + LoadingSkeleton 组件

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/loading-skeleton.tsx`

- [ ] **Step 1: 创建 EmptyState 组件**

```tsx
// src/components/ui/empty-state.tsx
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 opacity-50" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建 LoadingSkeleton 和 LoadingIndicator 组件**

```tsx
// src/components/ui/loading-skeleton.tsx
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  lines?: number
  className?: string
}

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-muted"
          style={{ width: `${85 - i * 10}%` }}
        />
      ))}
    </div>
  )
}

interface LoadingIndicatorProps {
  text?: string
  className?: string
}

export function LoadingIndicator({ text = "加载中...", className }: LoadingIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
```

- [ ] **Step 3: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/empty-state.tsx src/components/ui/loading-skeleton.tsx
git commit -m "feat(ui): add EmptyState and LoadingSkeleton/LoadingIndicator components (B-Phase 1)"
```

---

## Task 2: ErrorBoundary 组件 + layout 包裹

**Files:**
- Create: `src/components/ui/error-boundary.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建 ErrorBoundary 客户端组件**

```tsx
// src/components/ui/error-boundary.tsx
"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
          <h2 className="text-lg font-medium text-foreground">页面出错了</h2>
          <p className="mt-1 max-w-md text-center text-sm">
            {this.state.error?.message ?? "发生了未知错误"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: 在 layout.tsx 中包裹 children**

在 `src/app/layout.tsx` 中：
1. 添加 import：`import { ErrorBoundary } from "@/components/ui/error-boundary"`
2. 将 `<main>` 内的 `{children}` 包裹为 `<ErrorBoundary>{children}</ErrorBoundary>`

修改后的 main 行：
```tsx
<main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
  <ErrorBoundary>{children}</ErrorBoundary>
</main>
```

- [ ] **Step 3: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/error-boundary.tsx src/app/layout.tsx
git commit -m "feat(ui): add ErrorBoundary and wrap layout children (B-Phase 1)"
```

---

## Task 3: 裸 button 迁移 — Admin 页面（18 个 / 3 文件）

**Files:**
- Modify: `src/app/admin/users/page.tsx`（11 个 raw button）
- Modify: `src/components/admin/AdminShell.tsx`（4 个 raw button）
- Modify: `src/app/admin/page.tsx`（2 个 raw button）
- 注意：articles/[id] 的 line 1113 button 属于图片预览弹窗，不迁移。

每个 raw button 替换为 shadcn `<Button>`，保留原有的 onClick、disabled、className（追加到 Button className）和 children。variant 选择：操作按钮 → ghost，提交 → default，取消 → outline，危险 → destructive。

- [ ] **Step 1: 迁移 admin/users/page.tsx 的 11 个 raw button**

添加 import：`import { Button } from "@/components/ui/button"`

逐一替换（保留原有 className 作为追加，添加 variant 和 size）：

| 行 | 用途 | variant | size |
|----|------|---------|------|
| 222 | 刷新按钮 | outline | default |
| 230 | 创建用户 | default | default |
| 292 | 禁用用户 | ghost | icon-xs |
| 300 | 启用用户 | ghost | xs |
| 308 | 重置密码 | ghost | icon-xs |
| 331 | 关闭弹窗 X | ghost | icon-sm |
| 387 | 取消创建 | outline | default |
| 393 | 确认创建 | default | default |
| 411 | 关闭重置弹窗 X | ghost | icon-sm |
| 426 | 取消重置 | outline | default |
| 432 | 确认重置 | default | default |

示例替换（line 222 刷新按钮）：
```tsx
// Before
<button
  onClick={() => { setRefreshing(true); void fetchUsers(); }}
  disabled={refreshing}
  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
>
  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
  刷新
</button>

// After
<Button
  variant="outline"
  onClick={() => { setRefreshing(true); void fetchUsers(); }}
  disabled={refreshing}
>
  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
  刷新
</Button>
```

对所有 11 个 button 执行类似替换，删除冗余的手写 className（shadcn Button 已内置）。

- [ ] **Step 2: 迁移 AdminShell.tsx 的 4 个 raw button**

添加 import：`import { Button } from "@/components/ui/button"`

| 行 | 用途 | variant | size |
|----|------|---------|------|
| 132 | 移动端菜单 | ghost | icon |
| 158 | 收起/展开侧栏 | ghost | icon-sm |
| 165 | 关闭移动菜单 | ghost | icon-sm |
| 225 | 退出登录 | ghost | icon-sm |

示例替换（line 132）：
```tsx
// Before
<button
  className="fixed top-4 left-4 z-30 rounded-lg border border-border bg-card p-2 lg:hidden"
  onClick={() => setMobileOpen(true)}
>
  <Menu className="h-5 w-5" />
</button>

// After
<Button
  variant="ghost"
  size="icon"
  className="fixed top-4 left-4 z-30 lg:hidden"
  onClick={() => setMobileOpen(true)}
>
  <Menu className="h-5 w-5" />
</Button>
```

- [ ] **Step 3: 迁移 admin/page.tsx 的 2 个 raw button**

添加 import：`import { Button } from "@/components/ui/button"`

| 行 | 用途 | variant | size |
|----|------|---------|------|
| 140 | 重新尝试 | default | sm |
| 205 | 手动刷新 | outline | sm |

- [ ] **Step 4: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/users/page.tsx src/components/admin/AdminShell.tsx src/app/admin/page.tsx
git commit -m "refactor: migrate 18 raw buttons to shadcn Button in admin pages (B-Phase 1)"
```

---

## Task 4: 裸 button 迁移 — 前台与组件（12 个 / 13 文件）

**Files:**
- Modify: `src/app/search/page.tsx`（1 button, line 273）
- Modify: `src/app/settings/ai/page.tsx`（1 button, line 144）
- Modify: `src/app/settings/ima/page.tsx`（1 button, line 140）
- Modify: `src/components/RootNav.tsx`（1 button, line 101）
- Modify: `src/components/ReviewCard.tsx`（1 button, line 132）
- Modify: `src/components/ArticleChecklist.tsx`（1 button, line 69）
- Modify: `src/components/articles/ArticlesPage.tsx`（1 button, line 932）
- Modify: `src/components/sync/SyncRecordsPage.tsx`（1 button, line 371）
- Modify: `src/components/ai/AiConfigPage.tsx`（1 button, line 294）
- Modify: `src/app/login/page.tsx`（1 button, line 107）
- Modify: `src/app/register/page.tsx`（1 button, line 121）
- Modify: `src/app/admin/login/page.tsx`（1 button, line 108）

每个文件添加 `import { Button } from "@/components/ui/button"`，替换 raw `<button>` 为 `<Button>`。

- [ ] **Step 1: 迁移前台页面 button（search, settings/ai, settings/ima）**

search/page.tsx line 273（filter remove X button）→ `Button variant="ghost" size="icon-xs"`
settings/ai/page.tsx line 144（返回箭头）→ `Button variant="ghost" size="icon"`
settings/ima/page.tsx line 140（返回箭头）→ `Button variant="ghost" size="icon"`

- [ ] **Step 2: 迁移组件 button（RootNav, ReviewCard, ArticleChecklist, ArticlesPage, SyncRecordsPage, AiConfigPage）**

RootNav.tsx line 101（退出）→ `Button variant="link" size="xs"`
ReviewCard.tsx line 132（折叠切换）→ `Button variant="ghost" size="sm" className="w-full justify-start"`
ArticleChecklist.tsx line 69（取消）→ `Button variant="ghost" size="sm" className="text-gray-300 hover:text-white"`
ArticlesPage.tsx line 932（文章标题点击）→ `Button variant="link" className="w-full truncate text-left"`
SyncRecordsPage.tsx line 371（复制 ID）→ `Button variant="ghost" size="icon-xs"`
AiConfigPage.tsx line 294（API key 眼睛切换）→ `Button variant="ghost" size="icon-xs" className="absolute right-2 top-1/2 -translate-y-1/2"`

- [ ] **Step 3: 迁移登录/注册页 button**

login/page.tsx line 107：
```tsx
// Before
<button
  type="submit"
  disabled={loading}
  className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 ..."
>
  {loading ? (<svg animate-spin>...) : null}
  {loading ? "登录中..." : "登录"}
</button>

// After
<Button
  type="submit"
  disabled={loading}
  size="lg"
  className="mt-2 w-full"
>
  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
  {loading ? "登录中..." : "登录"}
</Button>
```

register/page.tsx line 121：同上模式，文案为"注册"。
admin/login/page.tsx line 108：同上模式，文案为"登录管理后台"。

三个文件都需要添加 `import { Loader2 } from "lucide-react"`（如果尚未 import），并删除旧的 inline SVG spinner。

- [ ] **Step 4: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate 12 raw buttons to shadcn Button across frontend and components (B-Phase 1)"
```

---

## Task 5: 裸 input + select 迁移（15 个 input + 1 个 select / 6 文件）

**Files:**
- Modify: `src/app/admin/users/page.tsx`（5 raw input + 1 raw select）
- Modify: `src/components/ai/AiConfigPage.tsx`（4 raw input，排除 line 213 range slider）
- Modify: `src/app/login/page.tsx`（2 raw input）
- Modify: `src/app/admin/login/page.tsx`（2 raw input）
- Modify: `src/components/UpgradeButton.tsx`（1 raw input, line 52）
- Modify: `src/app/settings/ai/page.tsx`（1 raw input, line 213 → 保留，这是 range slider 不迁移）

注意：`src/app/settings/ai/page.tsx` line 213 的 `<input type="range">` 不迁移（温度滑块）。

实际迁移 15 个 input + 1 个 select。

- [ ] **Step 1: 迁移 admin/users/page.tsx 的 5 input + 1 select**

添加 import：`import { Input } from "@/components/ui/input"` 和 `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"`

5 个 input（lines 338, 347, 357, 366, 418）全部为文本/密码输入，替换模式：
```tsx
// Before
<input
  value={newUsername}
  onChange={(e) => setNewUsername(e.target.value)}
  placeholder="3-32 个字符"
  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ..."
/>

// After
<Input
  value={newUsername}
  onChange={(e) => setNewUsername(e.target.value)}
  placeholder="3-32 个字符"
/>
```

Line 347 的 password input 保留 `type="password"`：`<Input type="password" ... />`

Line 375 的 select 替换：
```tsx
// Before
<select
  value={newRole}
  onChange={(e) => setNewRole(e.target.value)}
  className="w-full rounded-lg border ..."
>
  <option value="USER">普通用户</option>
  <option value="VERIFIED_USER">认证用户</option>
  <option value="ADMIN">管理员</option>
</select>

// After
<Select value={newRole} onValueChange={(val) => setNewRole(val as string)}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="选择角色" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="USER">普通用户</SelectItem>
    <SelectItem value="VERIFIED_USER">认证用户</SelectItem>
    <SelectItem value="ADMIN">管理员</SelectItem>
  </SelectContent>
</Select>
```

注意：shadcn Select 使用 `onValueChange` 而非 `onChange`，且 value 需要类型断言。

- [ ] **Step 2: 迁移 AiConfigPage.tsx 的 4 input**

Lines 272, 287, 310, 320 均为文本/数字输入。Line 320（type="number"）保留 `type="number"` 和 `min/max/step` 属性。

```tsx
// Before (line 272)
<input
  type="text"
  value={baseUrl}
  onChange={(e) => setBaseUrl(e.target.value)}
  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
  placeholder="https://api.deepseek.com/v1"
/>

// After
<Input
  value={baseUrl}
  onChange={(e) => setBaseUrl(e.target.value)}
  placeholder="https://api.deepseek.com/v1"
  className="mt-1"
/>
```

Line 287 的 password/text toggle input 保留 `type={showKey ? "text" : "password"}`。
Line 320 的 number input：`<Input type="number" min={0} max={1} step={0.1} value={temperature} ... />`

- [ ] **Step 3: 迁移 login/admin-login 的 4 input + UpgradeButton 的 1 input**

login/page.tsx lines 81, 96：
```tsx
// Before
<input id="username" type="text" placeholder="请输入账号" ... className="...rounded-xl..." />

// After
<Input id="username" type="text" placeholder="请输入账号" disabled={loading} />
```

admin/login/page.tsx lines 82, 97：同上模式。

UpgradeButton.tsx line 52：
```tsx
// Before
<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="邀请码" className="border rounded px-2 py-1 w-full mb-3" />

// After
<Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="邀请码" className="mb-3" />
```

- [ ] **Step 4: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate 15 raw inputs and 1 select to shadcn components (B-Phase 1)"
```

---

## Task 6: 空状态统一（7 处）+ Loading 升级（2 处）

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/components/subscriptions/SubscriptionsPage.tsx`
- Modify: `src/components/ai/AiConfigPage.tsx`
- Modify: `src/components/ArticleDetail.tsx`
- Modify: `src/components/CollectDialog.tsx`
- Modify: `src/components/articles/ArticlesPage.tsx`

- [ ] **Step 1: 替换 7 处内联空状态为 EmptyState 组件**

每个文件添加 `import { EmptyState } from "@/components/ui/empty-state"` 和对应的 lucide icon import。

**page.tsx**（"暂无内容"，line 237-244）：
```tsx
// Before: 内联 div + FileText icon + p + p
// After
<EmptyState icon={FileText} title="暂无内容" description="点击「浏览内容」开始采集" />
```

**admin/users/page.tsx**（"暂无用户数据"，line 247-250）：
```tsx
<EmptyState icon={Users} title="暂无用户数据" description="点击「创建用户」添加第一个用户" className="py-16" />
```

**SubscriptionsPage.tsx**（"暂无来源"，line 712-715）：
```tsx
<EmptyState title="暂无来源" description="点击「新建来源」添加第一个采集来源" className="h-48" />
```

**AiConfigPage.tsx**（"暂无提示词模板"，line 370）：
```tsx
<EmptyState title="暂无提示词模板" description="系统将自动生成默认模板" />
```

**ArticleDetail.tsx**（"暂无全文内容"，line 252）：
```tsx
// Before: article.fullText ?? "暂无全文内容"
// After: 条件渲染
{article.fullText ? (
  <div className="text-sm leading-relaxed whitespace-pre-wrap">{article.fullText}</div>
) : (
  <EmptyState title="暂无全文内容" description="文章全文尚未采集" className="py-8" />
)}
```

**CollectDialog.tsx**（"没有已启用的来源"，line 351-354）：
```tsx
<EmptyState title="暂无可用来源" description="请先在来源管理中启用来源" className="py-8" />
```

**ArticlesPage.tsx**（"暂无符合条件的文章"，line 870-873）：
```tsx
<EmptyState
  title="暂无符合条件的文章"
  description={managementMode ? "尝试调整筛选条件或点击「开始采集」获取内容" : "尝试调整筛选条件后重新搜索"}
  className="h-48"
/>
```

- [ ] **Step 2: 升级 2 处 loading 状态**

**page.tsx**（首页，无 loading 状态）：这是 server component，数据在服务端获取。如果数据获取慢，用户会看到 Next.js 的路由级 loading。此处不需要客户端 LoadingSkeleton。跳过此文件。

**AiConfigPage.tsx**（line 197-203，纯文本 "加载中..."）：
```tsx
// Before
if (loading) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">加载中...</p>
    </div>
  );
}

// After
import { LoadingIndicator } from "@/components/ui/loading-skeleton"

if (loading) {
  return <LoadingIndicator className="h-full" />
}
```

- [ ] **Step 3: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: unify empty states with EmptyState component and upgrade loading indicators (B-Phase 1)"
```

---

## Task 7: FormField 组件 + 登录表单规范化

**Files:**
- Create: `src/components/ui/form-field.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: 创建 FormField 组件**

```tsx
// src/components/ui/form-field.tsx
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  helper?: string
  className?: string
  children: React.ReactNode
}

export function FormField({ label, error, required, helper, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helper && !error && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}
```

- [ ] **Step 2: 规范化 login/page.tsx 表单结构**

添加 import：`import { FormField } from "@/components/ui/form-field"`

将表单区域的手写 `<label>` + `<Input>` 包裹为 `<FormField>`：
```tsx
// Before
<div>
  <label htmlFor="username" className="...">账号</label>
  <Input id="username" type="text" placeholder="请输入账号" ... />
</div>
<div>
  <label htmlFor="password" className="...">密码</label>
  <Input id="password" type="password" placeholder="请输入密码" ... />
</div>

// After
<FormField label="账号" required>
  <Input id="username" type="text" placeholder="请输入账号" disabled={loading} />
</FormField>
<FormField label="密码" required>
  <Input id="password" type="password" placeholder="请输入密码" disabled={loading} />
</FormField>
```

删除旧的 `<label>` 和包裹 `<div>`，由 FormField 接管。同时去掉 `rounded-xl`（shadcn Input 已有 `rounded-lg`）。

- [ ] **Step 3: 规范化 admin/login/page.tsx 表单结构**

同 login/page.tsx 的模式，添加 FormField 包裹，删除旧 label/div。

- [ ] **Step 4: 规范化 register/page.tsx 表单结构**

register/page.tsx 的 Input 已经是 shadcn。只需：
1. 添加 FormField 包裹（如果现有 label 是手写的）
2. 确认 submit button 已在 Task 4 中迁移

- [ ] **Step 5: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add FormField component and standardize login/register forms (B-Phase 2)"
```

---

## Task 8: admin/users 表单 FormField 包裹

**Files:**
- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: 包裹创建用户弹窗内的表单字段**

添加 import：`import { FormField } from "@/components/ui/form-field"`

将创建用户弹窗内的 5 个 `label + Input` 组合替换为 FormField：
```tsx
// Before (line 337-343)
<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">用户名 *</label>
  <Input value={newUsername} onChange={...} placeholder="3-32 个字符" />
</div>

// After
<FormField label="用户名" required>
  <Input value={newUsername} onChange={...} placeholder="3-32 个字符" />
</FormField>
```

对所有 5 个字段（用户名、密码、显示名称、邮箱、角色 select）执行同样替换。角色字段用 FormField 包裹 Select。

- [ ] **Step 2: 包裹重置密码弹窗内的 input**

Line 417-423 的密码 input 用 FormField 包裹：
```tsx
<FormField label="新密码" required helper="至少 6 个字符">
  <Input type="password" value={resetPassword} onChange={...} placeholder="新密码（至少 6 个字符）" />
</FormField>
```

- [ ] **Step 3: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "refactor: wrap admin/users form fields with FormField (B-Phase 2)"
```

---

## Task 9: 裸 table 迁移（2 个 / 2 文件）

**Files:**
- Modify: `src/app/admin/page.tsx`（line 324, 近期任务表格）
- Modify: `src/app/admin/users/page.tsx`（line 253, 用户管理表格）

- [ ] **Step 1: 迁移 admin/page.tsx 的 raw table**

添加 imports：
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

替换：
```tsx
// Before
<div className="overflow-x-auto">
  <table className="w-full text-xs text-left">
    <thead>
      <tr className="border-b border-border text-muted-foreground">
        <th className="py-2 font-medium">任务类型</th>
        ...
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border/50">
        <td className="py-2">...</td>
        ...
      </tr>
    </tbody>
  </table>
</div>

// After
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>任务类型</TableHead>
      <TableHead>触发时间</TableHead>
      <TableHead>状态</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {recentTasks.map((task) => (
      <TableRow key={task.id}>
        <TableCell>{task.type}</TableCell>
        <TableCell>{task.triggeredAt}</TableCell>
        <TableCell>{task.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

保留所有现有数据绑定逻辑，仅替换 HTML 结构。

- [ ] **Step 2: 迁移 admin/users/page.tsx 的 raw table**

同模式替换 line 253 的用户管理表格。该表格有 7 列（用户名、显示名、邮箱、角色、状态、创建时间、操作），使用 `.map()` 渲染行。

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>用户名</TableHead>
      <TableHead>显示名</TableHead>
      <TableHead>邮箱</TableHead>
      <TableHead>角色</TableHead>
      <TableHead>状态</TableHead>
      <TableHead>创建时间</TableHead>
      <TableHead className="text-right">操作</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map((u) => (
      <TableRow key={u.id}>
        <TableCell>{u.username}</TableCell>
        {/* ... 其他列保持原有逻辑 ... */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

- [ ] **Step 3: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/users/page.tsx
git commit -m "refactor: migrate 2 raw tables to shadcn Table (B-Phase 3)"
```

---

## Task 10: 手写弹窗迁移（3 个 / 2 文件）

**Files:**
- Modify: `src/app/admin/users/page.tsx`（创建用户弹窗 + 重置密码弹窗）
- Modify: `src/components/UpgradeButton.tsx`（付费升级弹窗）

- [ ] **Step 1: 迁移 admin/users 的创建用户弹窗**

添加 imports：
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
```

替换 `fixed inset-0` 的 div 为 Dialog：
```tsx
// Before
{showCreateDialog && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2>创建新用户</h2>
        <button onClick={() => setShowCreateDialog(false)}>X</button>
      </div>
      {/* form fields */}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => setShowCreateDialog(false)}>取消</button>
        <button onClick={handleCreate}>创建</button>
      </div>
    </div>
  </div>
)}

// After
<Dialog open={showCreateDialog} onOpenChange={(open) => !open && setShowCreateDialog(false)}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>创建新用户</DialogTitle>
    </DialogHeader>
    {/* form fields — 已在 Task 8 中用 FormField 包裹 */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
      <Button onClick={handleCreate} disabled={creating}>
        {creating ? "创建中..." : "创建"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

注意：shadcn Dialog 的 `open` 和 `onOpenChange` 控制开关状态。DialogContent 自带关闭按钮（X）。

- [ ] **Step 2: 迁移 admin/users 的重置密码弹窗**

同模式：
```tsx
<Dialog open={showResetDialog !== null} onOpenChange={(open) => !open && setShowResetDialog(null)}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>重置密码</DialogTitle>
    </DialogHeader>
    <DialogDescription>
      为用户设置新密码，至少 6 个字符。
    </DialogDescription>
    <FormField label="新密码" required helper="至少 6 个字符">
      <Input type="password" value={resetPassword} onChange={...} placeholder="新密码（至少 6 个字符）" />
    </FormField>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowResetDialog(null)}>取消</Button>
      <Button variant="destructive" onClick={handleResetPassword} disabled={resetting || resetPassword.length < 6}>
        {resetting ? "重置中..." : "确认重置"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

添加 import：`import { DialogDescription } from "@/components/ui/dialog"`

- [ ] **Step 3: 迁移 UpgradeButton.tsx 的付费弹窗**

```tsx
// Before
{open && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
    <div className="bg-white p-6 rounded max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
      <h3>升级为认证用户</h3>
      ...
    </div>
  </div>
)}

// After
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>升级为认证用户</DialogTitle>
    </DialogHeader>
    {/* 保留原有内容 */}
    <FormField label="邀请码">
      <Input value={code} onChange={...} placeholder="邀请码" />
    </FormField>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
      <Button onClick={handleUpgrade} disabled={upgrading}>
        {upgrading ? "处理中..." : "确认升级"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`

全项目 grep 验证：
```bash
grep -rn "fixed inset-0" src/ --include="*.tsx" | grep -v "src/components/ui/" | grep -v "articles/\[id\]/page.tsx" | grep -v "AdminShell.tsx"
```
Expected: 无输出（只剩不迁移的两个文件）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate 3 hand-written modals to shadcn Dialog (B-Phase 3)"
```

---

## Task 11: PageHeader 组件

**Files:**
- Create: `src/components/ui/page-header.tsx`

- [ ] **Step 1: 创建 PageHeader 组件**

```tsx
// src/components/ui/page-header.tsx
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/page-header.tsx
git commit -m "feat(ui): add PageHeader component (B-Phase 4)"
```

---

## Task 12: 视觉统一 — PageHeader 应用 + 卡片圆角 + 文案

**Files:**
- Modify: 前台页面约 10 个（articles/page, cards/page, search/page, review/page, settings 等）
- Modify: 使用 Card 且有自定义 rounded-xl/rounded-md 的文件

- [ ] **Step 1: 在前台页面标题区域应用 PageHeader**

逐文件替换自行实现的标题 div 为 PageHeader：

**src/app/cards/page.tsx**：
```tsx
// Before: <div><h1>素材卡片</h1><p>...</p></div>
// After
import { PageHeader } from "@/components/ui/page-header"
<PageHeader title="素材卡片" description="管理和浏览 AI 生成的素材卡" />
```

**src/app/search/page.tsx**：
```tsx
<PageHeader title="搜索" description="搜索文章和素材卡" />
```

**src/app/review/page.tsx**：
```tsx
<PageHeader title="复习" description="复习已收藏的素材卡" />
```

**src/app/settings/page.tsx**：
```tsx
<PageHeader title="设置" description="管理账户和应用配置" />
```

其他 settings 子页面（ai, ima, account, integrations）如果自行实现标题区域，同样替换。

后台页面已通过 AdminShell 统一 header，不重复替换。

- [ ] **Step 2: 统一卡片圆角**

搜索项目中覆盖 Card 默认圆角的位置：
```bash
grep -rn "rounded-md\|rounded-xl" src/ --include="*.tsx" | grep -v "src/components/ui/"
```

将业务组件中的 `rounded-md` / `rounded-xl` 覆盖改为 `rounded-lg`（与 shadcn Card 默认一致）。

注意：shadcn Card 本身使用 `rounded-xl`（card.tsx line 15），如果设计意图是统一为 `rounded-lg`，需要修改 `src/components/ui/card.tsx` 中的默认值。根据 spec 要求，统一为 `rounded-lg`。

修改 card.tsx：
```tsx
// Before (line 15)
"rounded-xl"
// After
"rounded-lg"
```

同时更新 CardHeader 的 `rounded-t-xl` → `rounded-t-lg`，CardFooter 的 `rounded-b-xl` → `rounded-b-lg`。

- [ ] **Step 3: 空状态文案标准化**

检查所有使用 EmptyState 的位置，确保文案格式统一为"暂无{名词}" + 可选操作引导：

| 位置 | 当前文案 | 标准化后 |
|------|---------|---------|
| page.tsx | "暂无内容" + "点击「浏览内容」开始采集" | ✅ 已符合 |
| admin/users | "暂无用户数据" + "点击「创建用户」..." | ✅ 已符合 |
| SubscriptionsPage | "暂无来源" + "点击「新建来源」..." | ✅ 已符合 |
| AiConfigPage | "暂无提示词模板" | 添加 description="系统将自动生成默认模板" |
| ArticleDetail | "暂无全文内容" | ✅ 已符合 |
| CollectDialog | "暂无可用来源" + "请先在来源管理中启用来源" | ✅ 已符合 |
| ArticlesPage | "暂无符合条件的文章" + 条件描述 | ✅ 已符合 |

- [ ] **Step 4: 验证构建**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: apply PageHeader, unify card border-radius and empty state copy (B-Phase 4)"
```

---

## 验证门禁

每个 Task 完成后必须通过：

```bash
pnpm lint && pnpm test && pnpm build
```

Phase 完成后额外检查：

```bash
# Phase 1 完成后
grep -rn "<button" src/ --include="*.tsx" | grep -v "src/components/ui/" | wc -l  # 应为 1（articles/[id] 图片预览）
grep -rn "<input" src/ --include="*.tsx" | grep -v "src/components/ui/" | wc -l   # 应为 10（date pickers + range slider）
grep -rn "<select" src/ --include="*.tsx" | grep -v "src/components/ui/" | wc -l  # 应为 0

# Phase 3 完成后
grep -rn "fixed inset-0" src/ --include="*.tsx" | grep -v "src/components/ui/" | grep -v "articles/\[id\]" | grep -v "AdminShell"  # 应为空
```
