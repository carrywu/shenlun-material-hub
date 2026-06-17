# UI 组件库评估报告

生成日期：2026-06-13
状态：评估完成

## 1. 当前技术栈

### 已安装依赖

| 包名 | 版本 | 用途 | 位置 |
|------|------|------|------|
| shadcn | ^4.8.2 | CLI 工具，生成本地组件 | dependencies |
| @base-ui/react | ^1.5.0 | 无样式 headless 原语（shadcn base-nova 风格基础） | dependencies |
| tailwindcss | ^4 | 原子化 CSS 框架 | devDependencies |
| @tailwindcss/postcss | ^4 | Tailwind PostCSS 插件 | devDependencies |
| lucide-react | ^1.17.0 | 图标库 | dependencies |
| sonner | ^2.0.7 | Toast 通知 | dependencies |
| zod | ^4.4.3 | Schema 验证 | devDependencies |
| tailwind-merge | ^3.6.0 | Tailwind 类名合并工具 | dependencies |
| class-variance-authority | ^0.7.1 | 组件变体管理 | dependencies |
| clsx | ^2.1.1 | 条件类名拼接 | dependencies |
| tw-animate-css | ^1.4.0 | Tailwind 动画扩展 | dependencies |
| react | 19.2.4 | UI 框架 | dependencies |
| next | 16.2.6 | 全栈框架 | dependencies |

### shadcn/ui 配置

- 风格：`base-nova`（基于 @base-ui/react 原语，非 Radix UI）
- 基础色：`neutral`
- CSS 变量：已启用
- 图标库：`lucide`
- RSC：已启用
- TSX：已启用
- 配置文件：`components.json`

### shadcn/ui 组件清单

目录 `src/components/ui/` 共 12 个组件：

| 组件文件 | 底层原语 | 被引用文件数 | 备注 |
|----------|----------|-------------|------|
| button.tsx | @base-ui/react/button | 40 | 使用最广泛 |
| badge.tsx | @base-ui/react/merge-props + use-render | 28 | 使用广泛 |
| card.tsx | 纯 HTML + Tailwind | 21 | 使用广泛 |
| input.tsx | @base-ui/react/input | 14 | 部分页面仍用原生 input |
| tabs.tsx | @base-ui/react/tabs | 2 | 仅卡片编辑器和卡片列表使用 |
| select.tsx | @base-ui/react/select | 7 | 后台页面大量使用原生 select |
| dialog.tsx | @base-ui/react/dialog | 7 | 部分弹窗仍用原生 div 实现 |
| table.tsx | 纯 HTML + Tailwind | 5 | 后台部分页面用原生 table |
| textarea.tsx | 纯 HTML + Tailwind | 较少 | 使用频率低 |
| checkbox.tsx | @base-ui/react/checkbox | 较少 | 使用频率低 |
| separator.tsx | @base-ui/react/separator | 较少 | 使用频率低 |
| pagination.tsx | 纯 HTML + Tailwind | 1 | 仅 ArticlesPage 使用 |

### 非 shadcn 自定义组件

目录 `src/components/`（不含 `ui/`）共 26 个业务组件：

**核心业务组件：**
- `MaterialCard.tsx` — 素材卡片展示
- `MaterialCardEditor.tsx` — 素材卡片编辑
- `ArticleDetail.tsx` — 文章详情展示
- `ArticlePreviewDialog.tsx` — 文章预览弹窗
- `ArticleChecklist.tsx` — 文章清单组件
- `ReviewCard.tsx` — 复习卡片
- `CollectDialog.tsx` — 采集弹窗
- `CollectButton.tsx` — 采集按钮
- `FavoriteButton.tsx` — 收藏按钮
- `UpgradeButton.tsx` — 升级按钮
- `BatchActions.tsx` — 批量操作
- `SyncToIma.tsx` — 同步到 iMa
- `WechatImportDialog.tsx` — 微信导入弹窗

**布局与导航组件：**
- `RootNav.tsx` — 前台顶部导航
- `MobileBottomTab.tsx` — 移动端底部 Tab
- `admin/AdminShell.tsx` — 后台管理 Shell（侧边栏 + 顶栏）

**页面级组件：**
- `articles/ArticlesPage.tsx` — 文章列表页
- `my-articles/MyArticlesPage.tsx` — 我的文章页
- `subscriptions/SubscriptionsPage.tsx` — 订阅管理页
- `sync/SyncRecordsPage.tsx` — 同步记录页
- `ai/AiConfigPage.tsx` — AI 配置页
- `integrations/WeweRssIntegrationPage.tsx` — WeWeRSS 集成页
- `ChannelManager.tsx` — 频道管理

**筛选组件：**
- `filters/DateRangeFilter.tsx`
- `filters/RegionFilter.tsx`
- `filters/SourceFilter.tsx`
- `filters/TopicFilter.tsx`

### 页面清单

共约 30 个页面（`src/app/**/page.tsx`）：

**前台页面（16 个）：**
- `/` — 首页
- `/login` — 用户登录
- `/register` — 用户注册
- `/articles` — 文章列表
- `/articles/[id]` — 文章详情
- `/cards` — 卡片列表
- `/cards/[id]` — 卡片详情
- `/discover` — 发现页
- `/explore` — 探索页
- `/search` — 搜索页
- `/review` — 复习页
- `/my-articles` — 我的文章
- `/subscriptions` — 订阅管理
- `/sync-records` — 同步记录
- `/settings/*` — 设置（account/ai/ima/integrations）
- `/integrations/we-mp-rss` — WeWeRSS 集成

**后台页面（14 个）：**
- `/admin` — 管理后台首页（概览）
- `/admin/login` — 管理员登录
- `/admin/articles` — 文章管理
- `/admin/sources` — 来源管理
- `/admin/sync-records` — 同步记录
- `/admin/tasks` — 异步任务
- `/admin/logs` — 系统日志
- `/admin/backup` — 数据备份
- `/admin/clean` — 数据清洗
- `/admin/users` — 用户管理
- `/admin/integrations/we-mp-rss` — 微信集成
- `/admin/settings/ai` — AI 配置
- `/admin/settings/quotas` — 配额管理

## 2. 现状评估

### 一致性

**shadcn/ui 组件使用情况：**
- Button 组件在 40 个文件中引用，是项目中使用最广泛的 shadcn 组件
- Badge 组件在 28 个文件中引用，使用广泛
- Card 组件在 21 个文件中引用，前后台均有使用
- Input 组件在 14 个文件中引用，但登录、注册、后台创建用户等页面仍使用原生 `<input>`
- Select 组件在 7 个文件中引用，后台页面（如用户管理的角色选择）仍使用原生 `<select>`
- Dialog 组件在 7 个文件中引用，但 AdminShell 和 admin/users 页面的弹窗使用原生 `div + fixed inset-0` 实现
- Table 组件在 5 个文件中引用，admin/users、admin/page.tsx 等仍使用原生 `<table>` 标签

**前后台差异：**
- 后台页面（AdminShell 体系）部分使用 Card/Table/Badge/Button，但不够一致
- 前台页面混用 shadcn 组件和手写 Tailwind 样式
- 登录页和注册页几乎全部使用手写样式（原生 input/button，无 shadcn 组件）

### 问题点

#### P1 — 组件使用不一致

1. **原生 `<button>` 泛滥**：17 个文件中存在 31 处原生 `<button>` 标签，包括：
   - `AdminShell.tsx`（4 处）：侧边栏折叠按钮、菜单按钮、退出按钮
   - `admin/users/page.tsx`（11 处）：操作按钮、弹窗关闭按钮、创建/取消按钮
   - `admin/page.tsx`（2 处）：概览页操作按钮
   - `login/page.tsx`（1 处）：登录提交按钮
   - `register/page.tsx`（1 处）：注册提交按钮
   - `articles/ArticlesPage.tsx`、`SyncRecordsPage.tsx`、`RootNav.tsx` 等

2. **原生 `<input>` / `<select>` 未统一**：
   - `login/page.tsx`、`register/page.tsx`、`admin/login/page.tsx` 使用原生 input
   - `admin/users/page.tsx` 创建用户弹窗使用原生 input + select
   - 手写 input 样式与 shadcn Input 组件样式有差异（rounded-xl vs rounded-md）

3. **手写弹窗**：5 个文件使用 `fixed inset-0 bg-black/40` 手写弹窗模式：
   - `admin/users/page.tsx`（创建用户、重置密码 2 个弹窗）
   - `articles/[id]/page.tsx`
   - `AdminShell.tsx`（移动端遮罩）
   - `UpgradeButton.tsx`

#### P2 — 缺少基础组件

4. **无 Loading Skeleton 组件**：
   - 加载中状态不统一：部分用 `Loader2` 旋转图标（AdminShell），部分用文字"加载中..."（AiConfigPage、SubscriptionsPage），部分用 `<Suspense fallback>` 内联文字
   - 缺少统一的骨架屏组件

5. **无统一空状态组件**：
   - "暂无用户数据"（admin/users）
   - "暂无内容"（page.tsx 首页）
   - "暂无来源"（SubscriptionsPage）
   - "暂无提示词模板"（AiConfigPage）
   - "暂无全文内容"（ArticleDetail）
   - "没有已启用的来源"（CollectDialog 测试中出现）
   - 各处的图标、排版、行动按钮不统一

6. **无 Error Boundary 组件**：
   - 全项目无 `ErrorBoundary` 组件
   - 错误处理分散在各组件内，无统一降级 UI

#### P3 — 技术栈冗余

7. **@base-ui/react 与 Radix UI 的关系**：
   - 项目使用 shadcn `base-nova` 风格，底层为 `@base-ui/react`
   - 未安装任何 `@radix-ui/*` 包
   - 这不是"两套 headless 库并存"的问题——当前仅使用 @base-ui/react
   - 但需注意：shadcn 的 base-nova 风格相对较新，部分组件（如 Select）的 API 可能与社区文档不完全一致

8. **Zod 未实际使用**：
   - zod 安装在 devDependencies（非常规——运行时验证应在 dependencies）
   - 应用源码中无任何 zod import
   - 仅 `scripts/mcp/sqlite-readonly-server.mjs` 中使用了 zod
   - 所有表单验证均为手写 if 判断（如 `if (!username || !password)`）

9. **表单验证不统一**：
   - 登录页：手写 `if (!username || !password)` + setError
   - 注册页：手写验证逻辑
   - 创建用户弹窗：手写 `if (!newUsername.trim() || !newPassword.trim())`
   - 无统一的表单验证方案

#### P4 — 样式一致性

10. **按钮样式不统一**：
    - shadcn Button：`rounded-md` + cva 变体
    - 登录页按钮：`rounded-xl` + `bg-gradient-to-r from-blue-600 to-indigo-600`
    - 后台按钮：`rounded-lg` + 手写 Tailwind 样式
    - 操作按钮：`rounded` + 最小内边距

11. **弹窗样式不统一**：
    - shadcn Dialog 组件有统一的 overlay/content 样式
    - 手写弹窗：`fixed inset-0 z-50 flex items-center justify-center bg-black/40` + 自定义卡片
    - 两种实现方式视觉效果不同

## 3. 方向建议

### 保持

- **shadcn/ui** 作为基础组件库（base-nova 风格）
- **Tailwind CSS v4** 作为样式方案
- **lucide-react** 作为图标库
- **sonner** 作为 toast 方案（17 个文件引用，使用良好）
- **@base-ui/react** 作为 shadcn 底层原语（这是 base-nova 风格的设计选择）

### 不引入（按需求确认文档）

- Ant Design / Ant Design Pro
- Arco Design
- Material UI
- HeroUI / NextUI
- Naive UI
- Element Plus
- TanStack Table（当前手写 table 可满足需求）
- React Hook Form（当前表单数量不多，用 state + 手写验证即可）

### 待评估

- **Zod 的定位**：当前未使用。若后续需要表单验证，应将 zod 移至 dependencies 并统一集成；若不需要，可考虑移除
- **后台表格需求**：当前 7 个后台页面使用原生 table，若后台功能复杂化（排序、筛选、分页联动），可评估引入 data-table 封装
- **base-nova 风格的成熟度**：shadcn base-nova 相对较新，部分组件功能可能不如 default（Radix）风格完善，需持续关注

## 4. 下一步计划

详见 `docs/audit/ui-refactor-plan.md`
