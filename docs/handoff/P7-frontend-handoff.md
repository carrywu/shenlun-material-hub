# P7 交接文档：前台重构

## 改了什么

### 三段式前台架构
| 页面 | 路径 | 内容 | 改造 |
|---|---|---|---|
| 今日推荐 | `/discover` | `featuredToday=true AND adminReviewStatus=approved`（管理员精选） | API + 页面文案 |
| 探索区 | `/explore` | 全部 `adminReviewStatus=approved`（图书馆） | API + 页面文案（移除「待核验」） |
| 我的文章 | `/my-articles`（新建） | 当前用户收藏（GET /api/favorites） | 新建页面 + 组件 |

### ⚠️ 方案调整（偏离原 plan）
原 plan 说「改造 `/articles` 为我的文章」。但调研发现 **`/articles` + `ArticlesPage.tsx` 是管理员文章管理页**（含 web/collect、批量 assess、批量 generate 等管理员操作），不能改成用户页。所以：
- **保留 `/articles` 作为管理员文章管理**（P7-T7 在此基础上加审核 UI）
- **新建 `/my-articles`** 作为用户收藏页

### 新建组件
- `src/components/my-articles/MyArticlesPage.tsx`：收藏列表 + 移除按钮（连带删卡）
- `src/components/FavoriteButton.tsx`：单篇收藏/移除（防抖 loading）
- `src/components/ArticleChecklist.tsx`：`useArticleChecklist` hook + `BatchFavoriteBar`（浮动条「已选 N 篇」）
- `src/components/UpgradeButton.tsx`：邀请码升级弹窗（调 `/api/auth/upgrade`，P8 实现接口）

### ArticleDetail 角色分支
- USER → 显示「🔒 升级为认证用户后可生成素材卡」+ UpgradeButton
- VERIFIED_USER / ADMIN → 原生卡管理 UI（生成/编辑）
- 用 `useAuth()` 拿当前用户角色

### 管理员审核页增强（ArticlesPage + BatchActions）
- **审核状态筛选**：全部/待AI/待审核/已通过/已拒绝（managementMode 下，AI 评估状态旁）
- **批量审核按钮**：审核通过 / 强制通过（需填理由）/ 拒绝
- **单篇推送今日推荐**：approved 文章行操作列「推荐」按钮（调 feature 接口）
- 调用 `/api/admin/content-items/review` 和 `/api/admin/content-items/feature`

### 导航
`src/components/RootNav.tsx`：加「我的文章」（Bookmark 图标，/my-articles），在探索区和文章列表之间

## 用户路径
```
今日推荐 (/discover)  ┐
                     ├─→ 点「+ 加入我的文章」─→ 我的文章 (/my-articles)
探索区 (/explore)     ┘                           ↓
                                          详情页生卡（VERIFIED_USER）
```

## ⚠️ 依赖
- **UpgradeButton 调 `/api/auth/upgrade`**：P8-T4 才实现。P7 交付 UI，端到端流程在 P8 后可验证。
- **ArticleChecklist 集成到 explore/discover 卡片**：组件已就绪，但未挂载到 explore/discover 页面（避免一次性改动太大、破坏现有卡片渲染）。后续可在 explore/discover 的卡片渲染处加 checkbox + BatchFavoriteBar。当前用户主要通过 FavoriteButton 单篇收藏。
- **管理员「推荐」按钮不反映已推荐状态**：`ContentItemData` 接口未含 `featuredToday`，按钮对已推荐文章仍显示（后端 feature 接口幂等，重复推送无害）。

## 测试结果（本地 worktree）
- `pnpm lint`：**0 error，16 warning**（既有）
- `pnpm test`：**321/321 passed**（47 文件，无新单测——前端 UI 改动靠 e2e + 类型检查）
- `pnpm build`：成功（含 `/my-articles`、`/admin/settings/quotas` 等新路由）
- e2e：
  - `explore-discover.spec.ts` 改造（「暂无待核验」→「暂无已审核」）
  - `frontend-experience.spec.ts` 新建 4 个页面加载用例

## 给 P8
- 实现 `/api/auth/upgrade` 让 UpgradeButton 端到端可用
- `loginAsUserAPI` / `loginAsVerifiedUserAPI` 就绪后，frontend-experience e2e 可扩展为完整 VERIFIED_USER 点击流
- 现有 explore 卡片上的「核验」/「已核验」按钮已语义过期（不再是核验流，是审核流）——P8 或后续可清理

## 相关 commit
- `045888d` feat(discover): today recommend shows featuredToday+approved articles
- `e4585e0` feat(explore): all approved articles library, drop pending-verification framing
- `7b4d12a` feat(ui): my-articles page + FavoriteButton + batch checklist
- `66bc43d` feat(detail): USER sees upgrade prompt, VERIFIED/ADMIN see generate
- `6145461` feat(admin/articles): review filter, batch review, force-approve, feature push
- `ae81106` test(e2e): frontend experience page-load flows
