# P4 交接文档：assess + review + feature

## 改了什么

### assess 路由收紧 + 状态写回
- `src/app/api/content-items/assess/route.ts`：`requireVerifiedUser` → `requireAdmin`
- AI 评估后写回 `adminReviewStatus`：
  - `accept` → `pending_admin`
  - `reject` → `rejected`
  - `error` → 保持 `pending_ai`（显式写回，便于重试）

### 新增 review 接口（`POST /api/admin/content-items/review`）
批量审核，事务内执行：
- **approve**（非 force）：要求所有文章 `aiDecision = accept`，否则 400
- **force-approve**：必须填 `note`（理由记审计日志），可破例通过 AI 拒绝的文章
- **reject**（下架）：删除该文章**全部 MaterialCard**（所有用户的私有卡 + 公共卡）+ 清 `featuredToday` + 置 `publicVisibleAt = null`
- 写审计日志（新增 `AuditAction = "review"` 到 audit-logger 类型）

### 新增 feature 接口（今日推荐）
- `POST /api/admin/content-items/feature`：推送，仅 `approved` 文章可推送（否则 400），设 `featuredToday = true`
- `DELETE /api/admin/content-items/feature?id=`：撤下，设 `featuredToday = false`

## 状态机（assess 后）
| AI 结果 | adminReviewStatus |
|---|---|
| accept | pending_admin（等管理员审） |
| reject | rejected |
| error | pending_ai（可重试） |

## 测试结果（本地 worktree）
- `pnpm lint`：**0 error，16 warning**（既有）
- `pnpm test`：**302/302 passed**（43 文件）
  - 新增：assess 3 + review 6 + feature 4 = 13 个新单测
- `pnpm build`：成功
- e2e：admin-review.spec.ts 5 个用例（全部 fixture 依赖，本地 skip）

## 关键设计决策
1. **下架删卡**：reject 时事务内删除该文章**全部** MaterialCard（不分 ownerUserId）。符合决策 4「管理员下架连带删所有用户基于该文章的素材卡」。⚠️ 这是不可逆操作，前端审核页需有明确警告。
2. **force-approve 二次确认**：通过 `force: true` + 必填 `note` 实现「再点一次确认 + 填理由」（决策 2）。审计日志记录理由。
3. **approved 才能推今日推荐**：feature POST 检查 `adminReviewStatus = approved`（决策 12）。
4. **下架自动清今日推荐**：reject 时 `featuredToday = false`，避免下架文章还挂在推荐位。

## 实现过程的关键修正
- **`vi.hoisted` 修复**：review 测试里 `tx` / `dbMock` 必须用 `vi.hoisted()` 包裹（vitest 把 `vi.mock` 提升到所有声明之前），否则 ReferenceError。这是 vitest mock 的标准模式。
- **role-aware mock**：assess/feature 测试里 `requireAdmin` mock 必须实现真实角色语义（非 ADMIN 返 null），否则 VERIFIED_USER 用例不会触发 403。
- **`AuditAction` 类型扩展**：`audit-logger.ts` 的 `AuditAction` union 加 `"review"`（route 用到，否则 tsc 报错）。

## 给后续 PR
- **P5** generate-card 准入检查改用 `adminReviewStatus = approved`（assess 已确保 accept→pending_admin，所以 generate-card 现在会被 pending_admin 拦住，符合预期——必须先 review approve）
- **P7** 后台审核页调用 review 接口，feature 接口驱动今日推荐按钮
- **P8** e2e 跑通时需要 staging 有 fixture 文章（pending_admin/rejected/approved+cards）

## 相关 commit
- `34b31c7` test(assess): lock admin-only permission
- `4306930` feat(assess): admin-only and write back adminReviewStatus
- `523f122` test(review): lock admin review endpoint behavior
- `6b4781f` feat(review): admin batch review with force-approve and card cleanup
- `1fb78b5` test(feature): lock today-recommend push/remove
- `399e435` feat(feature): admin push/remove today recommend
- `f064091` test(e2e): admin review flow with force-approve and takedown (fixture-dependent)
