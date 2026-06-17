# P8 交接文档：角色分层 + 注册流程 + 全套测试（最终）

## 改了什么

### 注册流程
- `src/app/api/auth/register/route.ts`：邀请码**可选**
  - 无邀请码 → 创建 `USER`
  - 有效邀请码 → 创建 `VERIFIED_USER` + 消费邀请码
  - 无效/过期/耗尽 → 400
  - 修复既有 bug：之前即使有邀请码也创建 USER（`role: "USER"` 硬编码）
- `src/app/register/page.tsx`：邀请码字段标「（可选）」+ helper 文案 + 空值不发送

### upgrade 接口（新建）
- `POST /api/auth/upgrade`：USER 输邀请码 → 升级 VERIFIED_USER
  - 复用 Invitation 校验（findUnique + 过期 + 耗尽 + 事务内 increment + 竞态保护）
  - VERIFIED_USER/ADMIN 再调 → 400
  - 写审计日志（`action: "upgrade"`，已加到 `AuditAction` union）
  - P7 的 UpgradeButton 弹窗现可端到端工作

### 角色权限验证
- 补 `src/app/api/settings/ai-config/__tests__/route.user-block.test.ts`：显式锁定 USER 被 AI 配置接口挡（401/403 + db 未被调用）

### e2e
- `e2e/helpers/auth.ts`：加 `loginAsUserAPI`（从 env 读 USER 凭据）
- `e2e/role-upgrade.spec.ts`：3 个用例（匿名注册→USER 通过；VERIFIED 注册 + USER 生卡依赖 fixture skip）

## 三角色最终权限矩阵
| 能力 | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|
| 注册 | 免费注册 | 注册时填邀请码 | 后台分配 |
| 看今日推荐/探索区/我的文章 | ✅ | ✅ | ✅ |
| 收藏文章 | ✅ | ✅ | ✅（不需，后台看全部） |
| 配 AI / IMA | ❌ | ✅ | ✅ |
| 生成素材卡 | ❌（详情页置灰 + 升级引导） | ✅（自付 Key） | ✅ |
| 升级路径 | 设置页弹窗 / 详情页 UpgradeButton | — | — |
| 采集/审核/推送今日推荐 | ❌ | ❌ | ✅ |

## 测试结果（本地 worktree，最终）
- `pnpm lint`：**0 error，16 warning**（全部既有未使用变量，与本次无关）
- `pnpm test`（vitest）：**331/331 passed**（50 文件）
- `pnpm build`：成功（含全部新路由：`/my-articles`、`/admin/settings/quotas`、`/api/auth/upgrade`、`/api/favorites`、`/api/admin/content-items/review`、`/api/admin/content-items/feature`、`/api/admin/role-quotas`）
- e2e：
  - `role-upgrade.spec.ts`：1 通过（匿名注册→USER），2 skip（fixture 依赖）
  - 其他 P1-P7 的 e2e 均已写入（fixture 依赖的 skip，staging 激活）

## ⚠️ 采集相关 e2e 风控状态（需求方要求标注）
本轮本地未触发 we-mp-rss 真实采集 e2e（`we-mp-rss.spec.ts` 依赖真实 we-mp-rss 服务）。**staging 部署后跑全量 e2e 时**，如果采集用例失败：
- 用 `detectWechatBlockPage()`（`src/services/collectors/wechat/weRssNormalizer.ts:53`）判断是否命中封禁关键词（环境异常/频繁访问/请先验证/完成验证后即可继续访问/当前环境异常/为你的访问安全）
- 命中 → **非代码 bug**，是微信风控；建议人工核查 we-mp-rss 服务状态

卡包生成 e2e（`material-card-ownership.spec.ts` 第 2 用例）会真实调用 AI 4 次。staging AI 不可达 / Key 配额耗尽 → 500，已加 `test.skip` 兜底。

## 重要说明：dev 库 migration 已 apply
P2 原计划「本地不 apply，staging apply」（方案 B）。但 P8-T7 跑 e2e 时，dev 库缺 `adminReviewStatus` 列导致 dashboard 报错，subagent 执行 `prisma migrate deploy` 应用了 review_flow migration 到 dev 库。
- **影响**：dev 库 schema 已含全部 P2 改动（审核字段、ArticleFavorite、RoleQuota、partial index）+ 历史数据已按规则回填
- **幂等性**：再次 `migrate deploy` 安全（所有回填带守卫，partial index 用 IF NOT EXISTS）
- **staging 仍需独立 apply**：staging 是独立数据库，apply 时核对回填数量分布（approved/rejected/pending_ai）

**未能从 worktree 直接验证回填数量**：Prisma 7 generated client + tsx 有模块解析 bug（`src/generated/prisma/index.json` 找不到），导致 seed 脚本和临时验证脚本无法运行。这是**既有工具链问题**（影响所有 seed 脚本，非本次引入）。staging 部署时用 `psql` 或修好 tsx 集成后核对。

## 相关 commit
- `652078d` test(register): lock optional invitation code behavior
- `1c1e041` feat(register): optional invitation code, role from code
- `6e2ad9e` test(upgrade): lock role upgrade behavior
- `d473427` feat(upgrade): USER upgrades to VERIFIED_USER via invitation
- `573b4e0` feat(register-ui): invitation code optional with hint
- `6388097` test(ai-config): verify USER is blocked
- `19ae13e` test(e2e): role separation + upgrade flow + loginAsUserAPI helper
