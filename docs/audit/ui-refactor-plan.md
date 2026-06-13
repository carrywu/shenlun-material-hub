# UI 渐进式改造计划

生成日期：2026-06-13
状态：计划完成，等待执行

## 1. 改造原则

- **渐进式**：不改已有功能，新页面/新组件优先使用规范组件
- **不引入新框架**：不引入 AntD / HeroUI / TanStack / React Hook Form
- **保持现有技术栈**：shadcn/ui (base-nova) + Tailwind CSS v4 + lucide-react + sonner
- **最小改动优先**：优先修复一致性问题，再补齐缺失组件

## 2. 分阶段计划

### Phase 1：基础组件补齐

**优先级：P2**
**预估工时：4-6 小时**

#### 1.1 创建统一空状态组件

**新建文件**：`src/components/ui/empty-state.tsx`

**接口设计**：
```tsx
interface EmptyStateProps {
  icon?: LucideIcon;        // lucide 图标
  title: string;            // 主标题，如"暂无数据"
  description?: string;     // 副标题说明
  action?: {                // 可选行动按钮
    label: string;
    onClick: () => void;
  };
}
```

**需要统一替换的位置**（当前 6 处不一致的空状态）：
- `src/app/page.tsx` — "暂无内容"
- `src/app/admin/users/page.tsx` — "暂无用户数据"
- `src/components/subscriptions/SubscriptionsPage.tsx` — "暂无来源"
- `src/components/ai/AiConfigPage.tsx` — "暂无提示词模板"
- `src/components/ArticleDetail.tsx` — "暂无全文内容"
- `src/components/CollectDialog.tsx` — "没有已启用的来源"

#### 1.2 创建统一加载骨架屏组件

**新建文件**：`src/components/ui/loading-skeleton.tsx`

**提供两种模式**：
- `LoadingSpinner` — 旋转图标 + 可选文字（替代当前分散的"加载中..."文字）
- `LoadingSkeleton` — 骨架屏条块（用于列表/表格加载态）

**需要统一替换的位置**（当前加载状态不统一）：
- `src/components/admin/AdminShell.tsx` — Loader2 旋转图标
- `src/components/ai/AiConfigPage.tsx` — "加载中..." 文字
- `src/components/subscriptions/SubscriptionsPage.tsx` — "加载中..." 文字
- `src/app/login/page.tsx` — Suspense fallback "加载中..."
- `src/components/my-articles/MyArticlesPage.tsx` — loading 状态
- 其他约 30 个文件中的 `loading` 状态展示

#### 1.3 创建 Error Boundary 组件

**新建文件**：`src/components/ui/error-boundary.tsx`

**实现 React class component ErrorBoundary**：
- 捕获子组件渲染错误
- 显示统一降级 UI（图标 + 错误描述 + 重试按钮）
- 可选 onError 回调（用于上报）

**建议包裹位置**：
- `src/app/layout.tsx` — 顶层 ErrorBoundary
- `src/components/admin/AdminShell.tsx` — 后台内容区

#### 1.4 统一 `<button>` 使用

**影响范围**：17 个文件，31 处原生 `<button>` 标签

**优先处理**：
- `src/app/login/page.tsx`（1 处）— 登录按钮 → Button variant="default"
- `src/app/register/page.tsx`（1 处）— 注册按钮 → Button variant="default"
- `src/app/admin/login/page.tsx`（1 处）— 管理员登录按钮 → Button variant="default"
- `src/app/admin/users/page.tsx`（11 处）— 操作按钮 → Button variant="ghost"/"outline"
- `src/components/admin/AdminShell.tsx`（4 处）— 图标按钮 → Button variant="ghost" size="icon"
- `src/app/admin/page.tsx`（2 处）— 操作按钮 → Button variant="outline"
- `src/app/explore/page.tsx`（1 处）
- `src/app/search/page.tsx`（1 处）
- `src/app/articles/[id]/page.tsx`（1 处）
- `src/app/settings/ai/page.tsx`（1 处）
- `src/app/settings/ima/page.tsx`（1 处）
- `src/components/RootNav.tsx`（1 处）
- `src/components/ReviewCard.tsx`（1 处）
- `src/components/ArticleChecklist.tsx`（1 处）
- `src/components/articles/ArticlesPage.tsx`（1 处）
- `src/components/sync/SyncRecordsPage.tsx`（1 处）
- `src/components/ai/AiConfigPage.tsx`（1 处）

---

### Phase 2：表单规范

**优先级：P3**
**预估工时：3-4 小时**

#### 2.1 创建表单 Field Wrapper 组件

**新建文件**：`src/components/ui/form-field.tsx`

**接口设计**：
```tsx
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;  // Input / Select / Textarea
}
```

**统一**：label 样式（text-xs font-medium text-muted-foreground）+ error 展示（text-xs text-red-600）

#### 2.2 统一登录/注册/后台表单

**需要改造的页面**：
- `src/app/login/page.tsx` — 原生 input + 手写 error + gradient 按钮
- `src/app/register/page.tsx` — 原生 input + 手写 error + gradient 按钮
- `src/app/admin/login/page.tsx` — 原生 input + 手写 error + gradient 按钮
- `src/app/admin/users/page.tsx` — 创建用户弹窗（原生 input + select）
- `src/app/settings/account/page.tsx` — 账户设置表单

**改造目标**：
- 使用 shadcn Input 替代原生 `<input>`
- 使用 shadcn Select 替代原生 `<select>`
- 使用 Button 替代原生 `<button>`
- 使用 FormField wrapper 统一 label + error 样式
- 统一 input 圆角（当前 login 用 rounded-xl，shadcn Input 用 rounded-md）

#### 2.3 Zod 集成评估

**当前状态**：
- zod 已安装在 devDependencies（^4.4.3）
- 应用源码中无任何 zod import
- 所有表单验证为手写 if 判断

**建议**：
- 若后续表单增多：将 zod 移至 dependencies，创建统一验证 schema
- 当前阶段（表单不多）：保持手写验证，不强制引入 zod
- 若引入 zod：创建 `src/lib/schemas/` 目录存放验证 schema

---

### Phase 3：后台表格与弹窗规范

**优先级：P3**
**预估工时：3-5 小时**

#### 3.1 统一后台 Table 使用

**当前状态**：
- shadcn Table 组件在 5 个文件中使用
- 原生 `<table>` 在 7 个后台页面使用

**需要迁移的页面**：
- `src/app/admin/users/page.tsx` — 用户管理表格
- `src/app/admin/page.tsx` — 概览页表格
- `src/app/admin/logs/page.tsx` — 系统日志表格（可能已用 Table，需验证）
- `src/app/admin/tasks/page.tsx` — 异步任务表格
- `src/app/admin/clean/page.tsx` — 数据清洗表格
- `src/app/admin/backup/page.tsx` — 备份记录表格

**改造目标**：
- 使用 shadcn Table/TableHeader/TableRow/TableCell 替代原生标签
- 统一表头样式（bg-muted/50 + font-medium text-muted-foreground）
- 统一行 hover 效果（hover:bg-muted/30）

#### 3.2 统一弹窗使用

**当前状态**：
- shadcn Dialog 组件在 7 个文件中使用
- 5 个文件使用手写 `fixed inset-0 bg-black/40` 弹窗

**需要迁移的位置**：
- `src/app/admin/users/page.tsx` — 创建用户弹窗 + 重置密码弹窗
- `src/app/articles/[id]/page.tsx` — 手写弹窗
- `src/components/UpgradeButton.tsx` — 升级弹窗

**改造目标**：
- 使用 shadcn Dialog/DialogContent/DialogHeader/DialogTitle 替代手写弹窗
- 统一弹窗圆角、间距、按钮布局

---

### Phase 4：前台视觉统一

**优先级：P4**
**预估工时：2-3 小时**

#### 4.1 统一卡片列表样式

**当前状态**：
- Card 组件在 21 个文件中使用，样式基本统一
- 部分页面（MaterialCard、ReviewCard）有自定义卡片样式

**改造目标**：
- 确保所有卡片使用 Card/CardHeader/CardContent/CardFooter 结构
- 统一卡片间距、圆角、border 颜色

#### 4.2 统一页面 Header 样式

**当前状态**：
- 后台页面 Header 由 AdminShell 提供（统一）
- 前台页面各自实现标题区域

**改造目标**：
- 创建可选的 `PageHeader` 组件（标题 + 副标题 + 操作区）
- 前台页面逐步采用

#### 4.3 统一空状态行动文案

**改造目标**：
- 统一使用 EmptyState 组件
- 规范行动文案格式："暂无{名词}" + "立即{动作}"
- 确保所有空状态都有明确的下一步行动引导

## 3. 不默认引入的库

以下库在改造过程中**不引入**，除非有明确的强需求：

| 库名 | 不引入原因 |
|------|-----------|
| Ant Design / Ant Design Pro | 与 shadcn/ui 风格冲突，bundle 大 |
| Arco Design | 同上 |
| Material UI | 设计语言不匹配 |
| HeroUI / NextUI | 组件覆盖不足，与 shadcn 定位重叠 |
| Naive UI | 生态较小，与 shadcn 定位重叠 |
| Element Plus | Vue 生态，不适用 |
| TanStack Table | 当前后台表格需求简单（静态渲染 + 基础分页），手写 table 即可满足 |
| React Hook Form | 当前表单数量不多（登录/注册/创建用户/设置），state + 手写验证足够 |

## 4. 验收标准

### 每个 Phase 完成后

- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm test` — 所有测试通过
- [ ] `pnpm build` — 构建成功
- [ ] 无新增 TypeScript 类型错误

### 视觉检查

- [ ] 390px（手机竖屏）截图对比
- [ ] 768px（平板）截图对比
- [ ] 1440px（桌面）截图对比
- [ ] 亮色/暗色模式均检查

### 回归测试

- [ ] 不影响已完成的功能（Batch 1-4）
- [ ] 登录/注册流程正常
- [ ] 后台管理功能正常
- [ ] 前台页面浏览/搜索/收藏/采集流程正常
- [ ] 所有弹窗正常打开/关闭
- [ ] 移动端导航正常

## 5. 改造优先级汇总

| 优先级 | 阶段 | 核心改动 | 影响文件数 |
|--------|------|----------|-----------|
| P2 | Phase 1 | 补齐 EmptyState/LoadingSkeleton/ErrorBoundary + 统一 Button | ~20 个文件 |
| P3 | Phase 2 | 表单 Field Wrapper + 统一登录注册表单 + Zod 评估 | ~6 个文件 |
| P3 | Phase 3 | 统一 Table + Dialog 使用 | ~8 个文件 |
| P4 | Phase 4 | 前台视觉统一（卡片/Header/空状态文案） | ~10 个文件 |
