# 前端改造第一轮（功能补全）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全 5 项功能缺口（A1-A5），使后端 API 能力在前端均有对应 UI 消费。

**Architecture:** 5 项任务按依赖关系排序：A3（删旧路由，无依赖）→ A2（Articles API + Tab）→ A1（学习状态标记）→ A4（归档箱 API + Tab）→ A5（确认弹窗）。每项独立可测试、可提交。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 6 / Tailwind CSS v4 / shadcn/ui (base-nova) / lucide-react / sonner

---

### Task 1: 旧路由清理（A3）

**Files:**
- Delete: `src/app/discover/page.tsx`
- Delete: `src/app/explore/page.tsx`
- Delete: `src/app/my-articles/page.tsx`
- Delete: `src/components/my-articles/MyArticlesPage.tsx`
- Check for dead imports: `src/components/ArticleChecklist.tsx`, `src/components/RootNav.tsx`, `src/app/page.tsx`, `src/proxy.ts`

- [ ] **Step 1: Grep 全项目确认无其他引用**

```bash
cd /Users/apple/Downloads/ima-shenglun-creators/shenlun-material-hub
grep -r "discover\|explore\|my-articles\|MyArticlesPage" src/ --include="*.tsx" --include="*.ts" -l | grep -v node_modules | grep -v ".test."
```

Expected: 只出现 `src/app/discover/`、`src/app/explore/`、`src/app/my-articles/`、`src/components/my-articles/MyArticlesPage.tsx` 自身文件。如果有其他文件引用了这些路由（如 import 或 Link href），需要先清理引用。

- [ ] **Step 2: 检查 E2E 测试是否引用旧路由**

```bash
grep -r "discover\|explore\|my-articles" e2e/ --include="*.ts" --include="*.spec.ts" -l
```

如果有 E2E spec 引用旧路由，需要同步删除或更新对应测试用例。

- [ ] **Step 3: 删除旧路由文件**

```bash
rm -rf src/app/discover
rm -rf src/app/explore
rm -rf src/app/my-articles
rm -rf src/components/my-articles
```

- [ ] **Step 4: 验证构建通过**

```bash
pnpm build
```

Expected: exit 0，无 dead import 错误。

- [ ] **Step 5: 运行全量测试**

```bash
pnpm lint && pnpm test
```

Expected: 0 lint errors, 379 tests pass。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 删除旧路由 /discover /explore /my-articles

按需求确认文档，旧路由不保留兼容重定向。
相关文件：discover/page.tsx, explore/page.tsx,
my-articles/page.tsx, MyArticlesPage.tsx

Tested: pnpm lint 0 errors, pnpm test 379 pass, pnpm build pass"
```

---

### Task 2: Articles 页面 Tab 切换（A2）

**Files:**
- Modify: `src/app/api/articles/route.ts`（添加 filter 参数）
- Modify: `src/app/api/articles/__tests__/route.test.ts`（添加 filter 测试）
- Modify: `src/components/articles/ArticlesPage.tsx`（添加 Tabs UI）

- [ ] **Step 1: 编写 API filter 参数测试**

在 `src/app/api/articles/__tests__/route.test.ts` 添加两个测试用例：

```ts
// filter=approved: 只返回 adminReviewStatus=approved 的文章
it("filter=approved restricts to approved articles", async () => {
  // 构造 request with ?filter=approved
  // mock db.contentItem.findMany 验证 where 包含 adminReviewStatus: "approved"
});

// filter=favorites: 联表 ArticleFavorite 查用户收藏
it("filter=favorites returns user's favorited articles", async () => {
  // 构造 request with ?filter=favorites
  // mock db.articleFavorite.findMany 返回 [{ contentItemId: "xxx" }]
  // 验证 db.contentItem.findMany 的 where.id.in 包含 "xxx"
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/app/api/articles/__tests__/route.test.ts
```

Expected: 新测试 FAIL（filter 参数未实现）。

- [ ] **Step 3: 实现 API filter 参数**

在 `src/app/api/articles/route.ts` 的 GET handler 中，`// 筛选参数` 区域之后、`// Visibility` 之前，添加：

```ts
// Tab 筛选
const filter = searchParams.get("filter");
if (filter === "approved") {
  where.adminReviewStatus = "approved";
} else if (filter === "favorites" && user) {
  const favs = await db.articleFavorite.findMany({
    where: { userId: user.id },
    select: { contentItemId: true },
  });
  const favIds = favs.map(f => f.contentItemId);
  if (favIds.length === 0) {
    return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 0 });
  }
  where.id = { in: favIds };
}
```

注意：`filter=approved` 应该覆盖非 ADMIN 用户原本的 contentVisibilityWhere 限制（允许普通用户看 approved 文章）。`filter=favorites` 需要 user 存在；匿名用户不返回收藏 Tab。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/app/api/articles/__tests__/route.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 5: 实现 ArticlesPage Tabs UI**

在 `src/components/articles/ArticlesPage.tsx` 中：

1. 在顶部 import 添加 `Tabs, TabsList, TabsTrigger` from `@/components/ui/tabs`
2. 添加 state：`const [activeTab, setActiveTab] = useState("all")`
3. 在 `fetchItems` 的 URLSearchParams 构建中添加：`if (activeTab !== "all") params.set("filter", activeTab === "recommended" ? "approved" : "favorites")`
4. 在 `useEffect` 依赖数组添加 `activeTab`
5. 在 Header 区域下方、筛选栏上方，插入 Tabs 组件：

```tsx
<Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
  <TabsList className="mx-6 mt-3">
    <TabsTrigger value="all">全部</TabsTrigger>
    <TabsTrigger value="recommended">推荐</TabsTrigger>
    <TabsTrigger value="favorites">收藏</TabsTrigger>
  </TabsList>
</Tabs>
```

6. 切换 Tab 时重置 page 为 1 并重新 fetch

- [ ] **Step 6: 验证构建**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(articles): 全部/推荐/收藏 Tab 切换

API: GET /api/articles 新增 filter 参数 (approved/favorites)
UI: ArticlesPage 添加 shadcn Tabs，切换时重新请求
推荐 = adminReviewStatus approved，收藏 = ArticleFavorite 联表

Tested: pnpm lint 0 errors, pnpm test pass, pnpm build pass"
```

---

### Task 3: 学习状态展示标记（A1）

**Files:**
- Modify: `src/components/articles/ArticlesPage.tsx`（列表项添加状态 Badge）
- Modify: `src/app/articles/[id]/page.tsx`（详情页标题区域展示状态）
- Modify: `src/app/cards/page.tsx`（卡片列表项展示 bookmarked 状态）

- [ ] **Step 1: 在 ArticlesPage 表格标题列添加状态图标**

在 `ArticlesPage.tsx` 的 TableBody 中，标题列 `<TableCell>` 内部，`<button>` 之前或之后添加状态标记：

```tsx
<TableCell className="font-medium max-w-[180px] md:max-w-[280px] truncate">
  <div className="flex items-center gap-1.5">
    {/* 状态标记 */}
    {(item as any).userRead && (
      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" title="已读" />
    )}
    {(item as any).userBookmarked && (
      <BookmarkCheck className="h-3.5 w-3.5 text-yellow-500 shrink-0" title="已收藏" />
    )}
    {(item as any).userIgnored && (
      <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" title="已忽略" />
    )}
    <button className="hover:underline text-left w-full truncate font-semibold text-foreground/85 hover:text-primary transition-colors" onClick={...}>
      {item.title}
    </button>
  </div>
</TableCell>
```

需要在 import 中添加 `CheckCircle, BookmarkCheck, EyeOff` from lucide-react。

注意：ContentItemData interface 需要扩展添加可选字段：

```ts
interface ContentItemData {
  // ...existing fields
  userRead?: boolean;
  userIgnored?: boolean;
  userBookmarked?: boolean;
}
```

这样 `(item as any)` 就不需要了。

- [ ] **Step 2: 在文章详情页标题区域展示状态**

在 `src/app/articles/[id]/page.tsx` 的 Header 区域，标题下方的 meta 信息行中添加：

```tsx
{article.userRead && (
  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
    <CheckCircle className="h-3 w-3 mr-1" /> 已读
  </Badge>
)}
{article.userBookmarked && (
  <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">
    <BookmarkCheck className="h-3 w-3 mr-1" /> 已收藏
  </Badge>
)}
{article.userIgnored && (
  <Badge variant="secondary" className="text-xs opacity-50">
    <EyeOff className="h-3 w-3 mr-1" /> 已忽略
  </Badge>
)}
```

同时在 ArticleDetail interface 中添加：

```ts
interface ArticleDetail {
  // ...existing fields
  userRead?: boolean;
  userIgnored?: boolean;
  userBookmarked?: boolean;
}
```

- [ ] **Step 3: 在卡片列表页展示收藏状态**

在 `src/app/cards/page.tsx` 的卡片网格中，每张卡片的标题区域添加：

```tsx
{card.userBookmarked && (
  <BookmarkCheck className="h-3.5 w-3.5 text-yellow-500" title="已收藏" />
)}
```

注意：素材卡 API（GET /api/material-cards）目前没有返回 userBookmarked。本任务只在前端预留展示位置，数据来自 materialCards 的关联查询（如果 ArticleDetail 中有 materialCards 数组，可以展示）。如果 API 不返回该字段，标记不显示即可。

- [ ] **Step 4: 验证构建**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: 全部通过。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(articles): 列表项展示已读/已收藏/已忽略状态标记

API 已返回 userRead/userIgnored/userBookmarked，
前端在文章列表标题列、文章详情页标题区域展示状态图标。
只做展示标记，不加操作入口。

Tested: pnpm lint 0 errors, pnpm test pass, pnpm build pass"
```

---

### Task 4: 归档箱 Tab（A4）

**Files:**
- Modify: `src/app/api/material-cards/route.ts`（支持 archivedOnly 参数）
- Modify: `src/app/api/material-cards/__tests__/route.test.ts`（添加测试）
- Modify: `src/app/cards/page.tsx`（添加已归档 Tab + 恢复按钮）

- [ ] **Step 1: 编写 API archivedOnly 参数测试**

在 `src/app/api/material-cards/__tests__/route.test.ts` 添加：

```ts
it("archivedOnly=true returns only archived cards", async () => {
  // mock db.materialCard.findMany
  // 验证 where 包含 archivedAt: { not: null }
});

it("default (no archivedOnly) excludes archived cards", async () => {
  // 验证 where 包含 archivedAt: null（已有行为）
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/app/api/material-cards/__tests__/route.test.ts
```

Expected: archivedOnly 测试 FAIL。

- [ ] **Step 3: 实现 API archivedOnly 参数**

在 `src/app/api/material-cards/route.ts` 的 GET handler 中：

```ts
const archivedOnly = searchParams.get("archivedOnly");
// 现有 where 中已有 archivedAt: null
// 修改为：
if (archivedOnly === "true") {
  where.archivedAt = { not: null };
}
// 默认保持 archivedAt: null
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/app/api/material-cards/__tests__/route.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 5: 实现 Cards 页面已归档 Tab**

在 `src/app/cards/page.tsx` 中：

1. Import `Tabs, TabsList, TabsTrigger` from `@/components/ui/tabs`
2. Import `ArchiveRestore, Clock` from lucide-react
3. 添加 state：`const [showArchived, setShowArchived] = useState(false)`
4. 修改 fetchCards 逻辑：当 `showArchived=true` 时，API 请求添加 `?archivedOnly=true`
5. 在页面顶部添加 Tabs：

```tsx
<Tabs value={showArchived ? "archived" : "all"} onValueChange={(v) => { setShowArchived(v === "archived"); }}>
  <TabsList>
    <TabsTrigger value="all">全部卡片</TabsTrigger>
    <TabsTrigger value="archived">已归档</TabsTrigger>
  </TabsList>
</Tabs>
```

6. 已归档卡片添加恢复按钮和归档时间显示：

```tsx
{showArchived && card.archivedAt && (
  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
    <span className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      归档于 {new Date(card.archivedAt).toLocaleDateString("zh-CN")}
    </span>
    <Button size="sm" variant="outline" onClick={() => handleRestore(card.id)}>
      <ArchiveRestore className="h-3 w-3 mr-1" /> 恢复
    </Button>
  </div>
)}
```

7. 实现 handleRestore：

```tsx
async function handleRestore(cardId: string) {
  try {
    const res = await fetch(`/api/material-cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchive" }),
    });
    if (res.ok) {
      toast.success("卡片已恢复");
      fetchCards();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "恢复失败");
    }
  } catch {
    toast.error("网络错误");
  }
}
```

- [ ] **Step 6: 验证构建**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cards): 已归档 Tab + 恢复功能

API: GET /api/material-cards 新增 archivedOnly=true 参数
UI: /cards 页面添加全部卡片/已归档 Tab，
已归档卡片显示归档时间和恢复按钮。
恢复调用 PATCH /api/material-cards/[id] action: unarchive

Tested: pnpm lint 0 errors, pnpm test pass, pnpm build pass"
```

---

### Task 5: 重新生成确认弹窗（A5）

**Files:**
- Create: `src/components/ui/alert-dialog.tsx`（shadcn AlertDialog）
- Modify: `src/components/ArticleDetail.tsx`（生成按钮添加确认逻辑）

- [ ] **Step 1: 安装 shadcn AlertDialog 组件**

检查 `src/components/ui/alert-dialog.tsx` 是否已存在。如不存在，手动创建（基于 @base-ui/react AlertDialog 原语，与现有 dialog.tsx 风格一致）：

```tsx
"use client";
// 基于 @base-ui/react 的 AlertDialog
// 导出：AlertDialog, AlertDialogTrigger, AlertDialogContent,
//        AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
//        AlertDialogDescription, AlertDialogAction, AlertDialogCancel
```

注意：shadcn v4 base-nova 的 alert-dialog 可能用 `@base-ui/react` 的 AlertDialog 而非 Radix。检查 `src/components/ui/dialog.tsx` 的实现方式，保持一致。

- [ ] **Step 2: 在 ArticleDetail.tsx 中添加确认弹窗逻辑**

在 `src/components/ArticleDetail.tsx` 中：

1. Import AlertDialog 组件
2. 添加 state：`const [showRegenConfirm, setShowRegenConfirm] = useState(false)`
3. 修改生成卡片按钮的 onClick：

```tsx
// 原逻辑：直接调用 generateCard()
// 新逻辑：
function handleGenerateClick() {
  // 检查是否已有素材卡
  if (article.materialCards.length > 0) {
    setShowRegenConfirm(true);
  } else {
    generateCard(); // 首次生成直接执行
  }
}
```

4. 在 JSX 末尾添加 AlertDialog：

```tsx
<AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认重新生成</AlertDialogTitle>
      <AlertDialogDescription>
        该文章已有素材卡，重新生成将覆盖现有内容并重置学习状态。是否继续？
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={() => {
          setShowRegenConfirm(false);
          generateCard(true); // force=true
        }}
      >
        重新生成
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

5. 修改 generateCard 函数接受 force 参数：

```tsx
async function generateCard(force = false) {
  // ...existing logic
  const body: Record<string, unknown> = { cardType: selectedCardType };
  if (force) body.force = true;
  // ...rest of fetch call
}
```

- [ ] **Step 3: 验证构建**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: 全部通过。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cards): 重新生成素材卡二次确认弹窗

已有素材卡时点击生成按钮弹出 AlertDialog 确认框，
确认后传 force:true 覆盖现有卡。首次生成直接执行不弹窗。
新建 alert-dialog.tsx 组件（base-ui/react 原语）。

Tested: pnpm lint 0 errors, pnpm test pass, pnpm build pass"
```

---

## 执行顺序与依赖

```
Task 1 (A3 旧路由清理)  ← 无依赖，最先做
    ↓
Task 2 (A2 Articles Tab) ← 无依赖
    ↓
Task 3 (A1 状态标记) ← 依赖 Task 2（在同一个 ArticlesPage.tsx 上改）
    ↓
Task 4 (A4 归档箱 Tab) ← 无依赖
    ↓
Task 5 (A5 确认弹窗) ← 无依赖
```

## 全局验证门禁

全部 5 个 Task 完成后运行：

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: 0 lint errors, 所有测试 pass, build 成功。
