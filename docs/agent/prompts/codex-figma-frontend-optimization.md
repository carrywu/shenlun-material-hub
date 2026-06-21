# Codex × Figma MCP：申论素材系统前端优化提示词

> 仓库：`carrywu/shenlun-material-hub`  
> 目标：使用官方 Figma MCP，在不破坏业务、RBAC、API 和测试的前提下，优化前台学习体验与后台管理体验。

---

## 直接交给 Codex 的提示词

```md
你负责优化 `carrywu/shenlun-material-hub` 的前端。

必须使用：

- 当前真实仓库代码；
- 官方 Figma Remote MCP；
- Playwright；
- 现有 shadcn/ui `base-nova` 组件；
- 当前 Tailwind CSS 4 和 CSS Variables；
- 当前 USER / VERIFIED_USER / ADMIN 权限规则。

禁止：

- 从零生成一个新网站；
- 引入 Ant Design、MUI、HeroUI、Chakra 等第二套组件库；
- 直接复制 Figma 自动生成代码覆盖项目；
- 修改 API、Prisma、数据库、RBAC 或业务语义；
- 用假数据替代真实页面；
- 一次性重构整站；
- 未经人工批准直接实现 Figma 设计；
- 为通过测试而删除断言、降低断言或随意 skip；
- 声称未实际运行的测试已经通过。

整个任务按以下阶段执行：

```text
Phase 0  恢复现场与代码审计
Phase 1  捕获真实 UI 到 Figma
Phase 2  Figma 设计系统与信息架构
Phase 3  核心页面设计
STOP     等待人工批准
Phase 4  按批准 Frame 分批实现
Phase 5  测试、截图、交付
```

---

# Phase 0：恢复现场与代码审计

## 0.1 必读文件

开始前完整读取：

```text
AGENTS.md
CLAUDE.md
docs/agent/final-requirements.md
docs/agent/validation-matrix.md
docs/testing.md
docs/audit/requirements-confirmation.md
docs/audit/development-todolist.md
docs/audit/development-handoff.md
docs/audit/ui-assessment.md
docs/audit/ui-refactor-plan.md
package.json
components.json
src/app/globals.css
```

注意：

- `docs/audit/ui-assessment.md` 是历史审计，不得当作当前事实。
- 当前代码已经完成一轮 shadcn 统一，包括 EmptyState、Loading、ErrorBoundary、FormField、PageHeader、Table 和 Dialog 等。
- 发现文档与当前需求冲突时，标记 `Requirement Conflict`。
- 以当前用户要求和 `docs/agent/final-requirements.md` 为准。

## 0.2 恢复可能存在的未完成工作

先执行：

```bash
pwd
git status --short --branch
git branch --show-current
git branch --all
git log --oneline --decorate -30
git log --all --oneline --decorate --grep="figma\|stitch\|frontend\|ui\|reader" -30
git diff --stat
git diff
git diff --cached --stat
git diff --cached
git stash list
git worktree list
git reflog -30
```

禁止执行：

```bash
git reset --hard
git clean
git checkout -- .
git restore .
git stash drop
git push --force
```

存在未提交工作时：

1. 保存完整 diff；
2. 区分 Figma 工作、前端实现、测试、文档、无关用户修改；
3. 不修改无法确认归属的内容；
4. 创建：

```text
tasks/YYYY-MM-DD-figma-frontend-recovery/recovery-report.md
```

## 0.3 验证 Figma MCP

列出当前 Figma MCP 工具，确认是否支持：

- 获取 Figma 文件和节点；
- 获取变量、组件和布局上下文；
- 捕获 localhost UI 到 Figma；
- 写入 Figma Canvas；
- 创建或更新 Frame；
- 获取设计资源。

如尚未连接，Codex CLI 使用：

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
```

如使用 Codex App，优先安装官方 Figma Plugin。

如果当前客户端不支持 Live UI Capture：

- 不得伪造捕获成功；
- 使用 Playwright保存基线截图；
- 输出人工捕获清单；
- 在需要写入 Figma 时停止报告。

## 0.4 创建任务文档

创建：

```text
tasks/YYYY-MM-DD-figma-frontend-optimization/
├── plan.md
├── todo.md
├── design-audit.md
├── figma-handoff.md
├── handoff.md
└── evidence/
```

中大型任务没有 TodoList 时不得修改代码。

---

# Phase 1：捕获真实 UI 到 Figma

## 1.1 启动项目

读取项目脚本、Playwright 配置和数据库要求，不得猜测端口。

优先使用仓库正确命令，例如：

```bash
pnpm dev
```

不得重置真实数据库，不得输出 `.env` 或密钥。

## 1.2 使用真实角色

必须分别验证：

```text
USER
VERIFIED_USER
ADMIN
```

不得用管理员页面代替普通用户体验。

## 1.3 创建 Figma 文件

创建或复用：

```text
申论素材系统｜Frontend Redesign
```

不得重复创建同名文件。

建立 Pages：

```text
00 Cover & Index
01 Current UI
02 Foundations
03 Components
04 User Experience
05 Admin Experience
06 Prototype
07 Dev Handoff
99 Archive
```

## 1.4 捕获真实页面

使用 Figma MCP 的 Live UI Capture，把页面转换为可编辑 Layers。

前台：

```text
/login
/register
/
/articles
/articles/[真实文章 ID]
/cards
/cards/[真实卡片 ID]
/search
/review
/settings
/settings/account
/settings/ai
/settings/ima
/subscriptions
/sync-records
```

后台：

```text
/admin
/admin/articles
/admin/sources
/admin/integrations/wechat-rss
/admin/sync-records
/admin/tasks
/admin/logs
/admin/settings/ai
/admin/backup
/admin/clean
/admin/invitations
/admin/users
```

只捕获真实存在的路由，不得恢复已经删除的旧页面。

核心页面视口：

```text
390 × 844
768 × 1024
1280 × 900
1440 × 1000
```

核心页面包括：

```text
/
RootNav
MobileBottomTab
/articles
/articles/[id]
/cards
/review
/admin
/admin/articles
AdminShell
```

## 1.5 捕获关键状态

至少覆盖：

```text
loading
empty
error
disabled
selected
dialog open
filter expanded
mobile menu open
dark mode
long title
long Chinese content
```

文章详情额外覆盖：

```text
USER
VERIFIED_USER
ADMIN
有批注
无批注
有素材卡
无素材卡
AI 评估失败
AI 评估过期
无个人 AI 配置
同步 IMA 中
图片预览打开
导出菜单打开
无正文
```

同时用 Playwright保存 Current UI PNG：

```text
tasks/YYYY-MM-DD-figma-frontend-optimization/evidence/current/
```

文件名包含 route、role、viewport 和 state。

---

# Phase 2：Figma 设计系统与信息架构

## 2.1 从代码提取设计令牌

读取：

```text
src/app/globals.css
components.json
src/components/ui/
src/components/RootNav.tsx
src/components/MobileBottomTab.tsx
src/components/admin/AdminShell.tsx
```

在 `02 Foundations` 建立：

### Color Variables

映射现有变量：

```text
background
foreground
card
card-foreground
popover
popover-foreground
primary
primary-foreground
secondary
secondary-foreground
muted
muted-foreground
accent
accent-foreground
destructive
border
input
ring
sidebar
sidebar-foreground
sidebar-primary
sidebar-accent
sidebar-border
```

创建 Light / Dark Modes。

不得随意创建第二套品牌色。

### Typography

建立：

```text
Display
Page Title
Section Title
Card Title
Body
Article Body
Article Lead
Metadata
Label
Caption
Code / Debug
```

中文文章正文参考目标：

```text
桌面 17–18px
移动端 16–17px
行高 1.75–1.9
有效阅读宽度 680–760px
```

最终值必须在 Figma 中用真实中文长文验证。

### Spacing / Radius / Elevation

使用可映射到 Tailwind 的间距，复用现有圆角令牌，只保留必要阴影层级。

## 2.2 建立组件

在 `03 Components` 建立与代码对应的组件：

```text
Button
Icon Button
Badge
Card
Input
Textarea
Select
Checkbox
Tabs
Table
Dialog
Alert Dialog
Pagination
Toast
Empty State
Loading
Form Field
Page Header
Navigation Item
Account Menu
Bottom Tab Item
Filter Bar
Filter Drawer
Batch Action Bar
Article List Item
Article Status
Material Card
Review Card
AI Evaluation Summary
Annotation Item
Admin Sidebar Group
```

至少覆盖：

```text
default
hover
focus
active
disabled
loading
error（适用时）
dark mode
mobile（适用时）
```

在 `07 Dev Handoff` 建立 Figma ↔ Code 映射表，标注：

```text
reuse
refine
new candidate
do not implement
```

## 2.3 信息架构

建立用户主流程：

```text
登录
→ 首页学习工作台
→ 文章库
→ 阅读文章
→ 收藏或生成素材卡
→ 素材卡确认
→ 复习
→ 同步个人 IMA
```

角色能力严格按照：

```text
docs/agent/final-requirements.md
```

USER：

- 阅读已批准文章；
- 收藏；
- 复习收藏文章；
- 不可生成素材卡；
- 不可配置 AI / IMA；
- 不可进入后台。

VERIFIED_USER：

- USER 能力；
- 配置个人 AI；
- 生成自己的私有素材卡；
- 复习自己的卡；
- 配置个人 IMA；
- 同步自己的可见文章和自己的素材卡。

ADMIN：

- 进入后台并管理全局内容；
- 审核、reject、downlist、restore；
- 使用 IMA 时仍只能同步自己的素材卡到自己的 IMA。

---

# Phase 3：核心页面设计

## Batch 1：应用 Shell 与导航

重点检查当前代码：

```text
src/app/layout.tsx
src/app/admin/layout.tsx
src/components/RootNav.tsx
src/components/MobileBottomTab.tsx
src/components/admin/AdminShell.tsx
```

必须验证：

- 根布局始终渲染 RootNav；
- 后台又渲染 AdminShell；
- RootNav 当前只隐藏登录页；
- 后台是否出现前台导航和后台导航叠加；
- `AdminShell h-screen` 是否造成高度或双滚动问题。

设计目标：

- 前台与后台 Shell 分离；
- `/admin/*` 不显示前台 RootNav；
- `/admin/login` 不显示 AdminShell；
- RootNav 有当前路由 active 状态；
- 用户名、角色、管理后台、设置、退出整合为账户菜单；
- MobileBottomTab 支持 safe-area；
- 文章详情固定操作不与底部 Tab 重叠；
- AdminShell 导航按业务分组。

后台导航建议在 Figma 中验证：

```text
概览

内容运营
- 文章管理
- 来源管理
- 微信集成

自动化与 AI
- 异步任务
- 同步记录
- AI 配置

用户与权限
- 用户管理
- 邀请码管理

系统维护
- 系统日志
- 数据备份
- 数据清洗
```

## Batch 2：首页学习工作台

当前 `src/app/page.tsx` 使用深色渐变 Hero、多个不同颜色统计块和快捷入口。

重新设计为角色化学习工作台。

USER 优先：

```text
继续阅读
今日推荐
收藏文章
收藏文章复习
最近阅读
```

VERIFIED_USER 增加：

```text
待确认素材卡
今日复习
最近生成
个人 AI 配置状态
IMA 同步状态
```

ADMIN 前台首页仍以个人学习为主，系统运营指标主要留在 `/admin`。

要求：

- 减少彩虹色统计卡；
- 不使用大面积紫色/深色渐变作为默认 Hero；
- 让下一步行动比累计数字更突出；
- 空状态必须有行动入口。

## Batch 3：文章库与后台文章管理分流

当前：

```text
src/components/articles/ArticlesPage.tsx
```

通过 `managementMode` 同时服务：

```text
/articles
/admin/articles
```

### `/articles`

定位为学习型文章库：

- 标题、来源、时间、内容体裁、标签、评分；
- 已读、收藏、忽略；
- 全部 / 推荐 / 收藏；
- 搜索和常用筛选；
- 高级筛选用 Drawer / Popover；
- 移动端不得显示压缩桌面表格；
- 不出现采集、审核、调试、owner、visibility。

### `/admin/articles`

定位为内容运营工作台：

- 高密度 Table；
- Sticky Header；
- 批量选中后显示 Batch Action Bar；
- 常用筛选常驻；
- 高级筛选收纳；
- 采集、AI 评估、审核层级清楚；
- Debug 仅开发环境或受控入口；
- 移动端使用管理卡片或合理横向策略。

允许共享数据逻辑，不强制共用完全相同的页面 UI。

## Batch 4：文章阅读器

真实页面主要位于：

```text
src/app/articles/[id]/page.tsx
```

正文渲染：

```text
src/components/articles/ArticleContentRenderer.tsx
```

必须保留：

- 收藏、已读、忽略；
- 查看原文；
- 同步 IMA；
- PDF / Word 导出；
- 带批注 / 无批注导出；
- AI 评估和五维评分；
- AI 失败 / 过期状态；
- VERIFIED_USER 私有素材卡生成；
- 已生成素材卡；
- 管理员手动批注、AI 批注、自动批注；
- 批注高亮和 Tooltip Portal；
- 图片代理和图片预览；
- DOMPurify 清洗；
- HTML / 纯文本降级。

桌面参考：

```text
阅读列 680–760px
学习侧栏 300–340px
整体 1200–1320px
```

AI 信息使用渐进披露：

```text
默认：
决策 + 总分 + 摘要

展开：
五维评分 + 理由 + 可用方向 + 推荐引用

管理员：
Debug 单独折叠
```

右侧栏按角色设计：

USER：

- 阅读状态；
- 收藏；
- 收藏文章复习；
- 克制的认证提示。

VERIFIED_USER：

- USER 能力；
- 素材卡类型；
- 生成素材卡；
- 已生成素材卡；
- AI 配置入口；
- IMA 同步。

ADMIN：

- 公开阅读视图提示；
- 后台管理入口；
- 批注；
- 自动批注；
- 调试信息。

移动端：

- 单栏阅读；
- AI 使用 Accordion；
- Sidebar 转为正文分区、Sheet 或 Bottom Sheet；
- 固定操作不遮挡正文；
- 与全局 Bottom Tab 协调；
- 390px 无横向滚动。

## Batch 5：素材卡与复习

`/cards`：

- 突出待确认和学习状态；
- 类型筛选在移动端收纳；
- 批量操作仅选中时出现；
- 归档状态清晰；
- 卡片网格适应 390px。

`/review`：

- 从 Dashboard 式布局改为专注学习；
- 当前复习内容是视觉中心；
- 统计信息降级；
- 手写 `<button>` Tab 统一为现有 Tabs；
- USER 不显示不可用的素材卡复习入口，或提供克制说明；
- 支持键盘和单手操作。

## Batch 6：后台和设置页

统一：

- PageHeader；
- FormField；
- Table；
- Dialog；
- Filter Bar；
- loading / empty / error；
- 危险操作确认；
- 表单错误位置；
- 密钥保护；
- 管理页信息密度。

不修改业务权限和接口。

---

# Phase 3.5：Figma 原型与交付

至少连接：

```text
登录
→ 首页
→ 文章库
→ 文章详情
→ 收藏 / 生成素材卡
→ 素材卡确认
→ 复习
→ IMA 同步
```

后台：

```text
后台首页
→ 文章管理
→ 采集
→ AI 评估
→ 审核
→ 发布到学习区
```

每个核心 Frame注明：

```text
route
role
viewport
state
implementation batch
existing component mapping
new component candidate
permission requirement
test requirement
```

生成：

```text
tasks/YYYY-MM-DD-figma-frontend-optimization/design-audit.md
tasks/YYYY-MM-DD-figma-frontend-optimization/figma-handoff.md
```

记录：

- Figma File URL；
- Frame / Node ID；
- Current vs Proposed；
- 设计令牌；
- 组件映射；
- 角色状态；
- 响应式规则；
- 无障碍要求；
- 实现优先级；
- 风险；
- 不采纳方案。

---

# 强制停止：等待人工批准

完成设计后必须停止。

不得：

- 修改 `src/`；
- 下载 Figma 代码覆盖项目；
- 新建实现组件；
- 自动选择方案；
- 同时实现所有 Batch。

最终只输出：

1. Figma File URL；
2. Current UI Page；
3. Foundations；
4. Components；
5. 核心 Frame 和 Node ID；
6. Prototype；
7. 推荐首批 Batch；
8. 预计改动文件；
9. 风险；
10. 等待用户批准。

只有用户明确给出：

```text
批准实现
Figma File URL
批准的 Frame / Node ID
批准的 Batch
```

才进入实现阶段。

---

# Phase 4：按批准 Frame 实现

## 4.1 读取 Figma Context

使用 Figma MCP读取批准 Frame：

- 变量；
- Auto Layout；
- 组件；
- 间距；
- 响应式规则；
- 图标和资源。

不得只看截图猜尺寸。

不得把 Figma 自动生成的绝对定位代码直接作为最终代码。

## 4.2 创建分支

```bash
git switch -c feat/figma-ui-<batch-name>
```

每个 Batch 独立实现和提交。

## 4.3 实现原则

- 复用现有 shadcn `base-nova`；
- 优先复用 `src/components/ui/`；
- 不修改 API、数据库、Prisma、RBAC；
- 不删除功能；
- 不使用假数据；
- 不创建无效按钮；
- 不大量使用内联 style；
- 不下载或提交字体文件；
- 保留语义 HTML、ARIA、键盘和 Focus；
- 新组件必须有明确复用价值。

可能的组件候选，仅在批准后评估：

```text
AccountMenu
DesktopNav
UserArticleLibrary
AdminArticleWorkspace
ArticleReaderHeader
ArticleReaderSidebar
ArticleAiEvaluation
ArticleMobileActions
AdminNavGroup
FilterDrawer
BatchActionBar
```

不得预先假定全部新增。

## 4.4 测试契约

保留或兼容现有：

```text
data-testid
aria-label
aria-pressed
data-state
data-pending
accessible name
```

文章详情重点保留：

```text
article-detail-page-header
article-content
article-bookmark-button
article-read-button
article-error-message
```

改变 selector 必须有可访问性或设计依据，并同步更新测试，不能降低断言。

---

# Phase 5：验证和交付

## 标准验证

```bash
pnpm lint
pnpm test
pnpm build
```

## Harness

```bash
pnpm harness:preflight
pnpm harness:validate
pnpm harness:validate:e2e
```

## 关键 Playwright

```bash
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/middleware.spec.ts
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
```

再运行本 Batch 新增测试。

## 视觉证据

每个批准页面保存：

```text
390 × 844
768 × 1024
1280 × 900
1440 × 1000
```

到：

```text
tasks/YYYY-MM-DD-figma-frontend-optimization/evidence/proposed/
```

制作：

```text
Current
Figma
Implementation
```

三方对比。

## axe

核心页面不得新增 serious / critical 问题。

## 移动端专项

验证：

- 无页面级横向滚动；
- Bottom Tab 不遮挡；
- 文章详情操作不重叠；
- Drawer 和 Dialog 可关闭；
- 表格合理降级；
- safe-area；
- 长中文标题；
- 触控目标；
- 虚拟键盘。

## Dark Mode

验证背景、卡片、边框、文本、Badge、Focus、语义色、批注、Dialog 和图片预览。

## Git

小步提交，不创建巨型提交。

最终报告：

```markdown
## Summary
## Approved Figma Frames
## Files Changed
## Components Reused
## Components Added
## Business Behaviors Preserved
## Responsive Changes
## Accessibility Changes
## Tests Run
## Results
## Screenshots
## Not Tested
## Risks
## Commits
## Rollback
## Next Step
```

未运行必须写“未运行”。

---

# 首批推荐

首次 Figma闭环只实现：

```text
Batch 1：应用 Shell 与导航
Batch 4：文章阅读器
```

先验证从 Figma设计到代码、测试和视觉回归的完整流程，再继续首页、文章列表、素材卡、复习和后台页面。

---

# 现在开始

1. 读取规则；
2. 恢复现场；
3. 验证 Figma MCP；
4. 创建 TodoList；
5. 启动项目；
6. 捕获 Current UI 到 Figma；
7. 建立 Foundations 和 Components；
8. 完成 Batch 1 和 Batch 4 的 Figma设计；
9. 输出 Figma URL、Frame Node ID、设计评审和预计改动；
10. 停止等待人工批准；
11. 未批准前不得修改业务代码。
```

---

## 人工审批模板

```md
批准进入实现阶段。

Figma File：
<FIGMA_FILE_URL>

批准 Batch：
- Batch 1：应用 Shell 与导航
- Batch 4：文章阅读器

批准 Frame：
- Desktop Shell：<NODE_ID>
- Mobile Shell：<NODE_ID>
- Article Reader Desktop：<NODE_ID>
- Article Reader Mobile：<NODE_ID>

实现要求：

- 保留现有业务和权限；
- 不修改 API、数据库和 Prisma；
- 使用现有 shadcn base-nova；
- 分小提交；
- 完成 lint、unit、build、Playwright、axe 和视觉对比；
- 每项完成后更新 TodoList；
- 未运行的测试明确标记。
```
