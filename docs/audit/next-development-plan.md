# 下一步开发计划

## 1. 总体判断
当前项目最应该优先解决：让文章详情、素材卡、AI/IMA 设置和 Playwright E2E 重新稳定，先恢复“可回归、可学习、可生成”的最小闭环。

## 2. P0 任务
| ID | 任务 | 原因 | 涉及文件 | 验收标准 | 推荐测试 |
|---|---|---|---|---|---|
| P0-001 | 修复 Playwright admin 认证 storageState | 全量 E2E 20 failed 后停止 | `e2e/global-setup.ts`, `e2e/helpers/auth.ts`, `playwright.config.ts` | `/admin`、`/admin/tasks`、`/admin/settings/ai` 不再落登录页 | `pnpm exec playwright test e2e/admin.spec.ts e2e/ai-config.spec.ts --workers=1` |
| P0-002 | 修复 `/cards` 请求失败与空状态 | 素材卡闭环中断 | `src/app/cards/page.tsx`, `src/app/api/material-cards/route.ts`, `src/components/MaterialCard*` | 0 卡片时显示中文空状态和生成入口，无 console 401/500 | `pnpm exec playwright test e2e/cards.spec.ts` |
| P0-003 | 修复文章详情页加载和 h1 语义 | 阅读路径中断，E2E 找不到 h1 | `src/app/articles/[id]/page.tsx`, `src/app/api/content-items/[id]/route.ts` | 从 `/articles` 首行进入详情，页面有可访问 h1 和正文 | `pnpm exec playwright test e2e/article-detail.spec.ts` |
| P0-004 | 修复 AI/IMA 设置 500 | 新用户配置核心能力受阻 | `src/app/api/ai-config/route.ts`, `src/app/api/settings/ai-config/route.ts`, `src/app/api/settings/ima-targets/route.ts`, `src/lib/crypto.ts` | 缺配置/缺密钥时显示中文错误态，不返回 500 | `pnpm exec playwright test e2e/ai-config.spec.ts e2e/settings.spec.ts` |

## 3. P1 任务
| ID | 任务 | 原因 | 涉及文件 | 验收标准 | 推荐测试 |
|---|---|---|---|---|---|
| P1-001 | 修复 dead-link spec 误报 | 当前检测命中 Next dev 内联 404 字符串 | `e2e/dead-link.spec.ts` | 不再用 body 全文查 `404`；真实 404 可失败 | `pnpm exec playwright test e2e/dead-link.spec.ts` |
| P1-002 | 修复 `/admin/tasks` React key warning | console guard 捕获错误 | `src/app/admin/tasks/page.tsx` | 无 unique key warning | `pnpm exec playwright test e2e/admin.spec.ts -g "异步任务"` |
| P1-003 | 同步记录错误中文化 | IMA 404 暴露底层路径 | `src/components/sync/*`, `src/services/ima-sync.ts` | 失败原因显示“知识库 ID 缺失/接口地址错误”等可操作说明 | `pnpm exec playwright test e2e/sync-records.spec.ts` |
| P1-004 | 为素材卡/复习/搜索空状态加引导 | 新用户不知道下一步 | `src/app/cards/page.tsx`, `src/app/review/page.tsx`, `src/app/search/page.tsx` | 空状态包含 CTA，点击进入文章列表或生成流程 | `pnpm exec playwright test e2e/cards.spec.ts e2e/review.spec.ts e2e/search.spec.ts` |
| P1-005 | 移动端文章列表改为卡片布局 | 表格移动端阅读差 | `src/components/articles/ArticlesPage.tsx` | 390px 宽度无遮挡，可点入详情 | `pnpm exec playwright test e2e/mobile-responsive.spec.ts` |
| P1-006 | RBAC A/B 用户数据隔离矩阵 | mock 测试不能证明真实隔离 | `e2e/data-isolation.spec.ts`, `src/lib/data-isolation.ts` | admin/userA/userB/public 四类断言通过 | `pnpm exec playwright test e2e/data-isolation.spec.ts` |

## 4. P2 任务
| ID | 任务 | 原因 | 涉及文件 | 验收标准 | 推荐测试 |
|---|---|---|---|---|---|
| P2-001 | 重建 visual regression 基线策略 | `/explore`、`/discover` 高度不一致 | `e2e/visual-regression.spec.ts`, `e2e/__screenshots__/*` | 明确 viewport/fullPage 分组，14 tests 稳定通过 | `pnpm exec playwright test e2e/visual-regression.spec.ts` |
| P2-002 | 新用户 onboarding checklist | 配置路径不清晰 | `src/app/settings/page.tsx`, `src/components/*` | 首次进入能看到 AI、来源、采集、生成、IMA 步骤 | 手动截图 + Playwright |
| P2-003 | 危险操作 dry-run E2E | 备份/清洗/删除未完整验证 | `e2e/admin.spec.ts`, `e2e/sources.spec.ts`, `e2e/wewe-rss.spec.ts` | 使用临时库验证取消、预览、确认链路 | `PLAYWRIGHT_BASE_URL=... pnpm exec playwright test ...` |
| P2-004 | 扩展 console guard 全路由 | 当前仅部分 spec 覆盖 | `e2e/helpers/consoleGuard.ts`, `e2e/*.spec.ts` | 关键页面无 500/React warning | `pnpm exec playwright test` |

## 5. P3 任务
| ID | 任务 | 原因 | 涉及文件 | 验收标准 | 推荐测试 |
|---|---|---|---|---|---|
| P3-001 | CI 分层门禁 | 全量 E2E 成本高 | `.github/workflows/*`, `package.json` | lint/unit/build/a11y/smoke/visual 分层运行 | CI dry-run |
| P3-002 | Prompt 版本管理 | AI 评估可追溯性不足 | `src/services/ai.ts`, Prisma schema | 每次生成记录 promptVersion | unit + migration dry-run |
| P3-003 | 线上监控与错误聚合 | 500/同步失败需可观测 | `src/lib/logger.ts`, `src/lib/audit-logger.ts` | 关键 API 失败可按类别检索 | route tests |
| P3-004 | 多用户工作区/角色细分 | 长期协作需求 | Prisma schema, RBAC 层 | workspace 隔离策略有设计文档和测试 | RBAC matrix |

## 6. 推荐开发顺序
1. P0-001 修复 Playwright admin 认证。
2. P0-002/P0-003 修复素材卡和文章详情。
3. P0-004 修复 AI/IMA 设置 500。
4. P1-001/P2-001 恢复 dead-link 和 visual regression。
5. P1 空状态、移动端、同步错误中文化。

## 7. 第一阶段详细 TodoList
- [ ] 修复 `e2e/global-setup.ts` 登录流程，改为 API 登录后写入 cookie/storageState。
- [ ] 复跑 `e2e/admin.spec.ts`，确保后台 h1 可见。
- [ ] 修复 `/api/material-cards` 在 0 数据和未登录/已登录状态下的返回。
- [ ] 给 `/cards` 增加可行动空状态。
- [ ] 修复文章详情 h1 与首篇文章详情进入路径。
- [ ] 修复 AI/IMA 设置缺配置时的 500。

## 8. 第二阶段详细 TodoList
- [ ] 重写 dead-link 检测逻辑。
- [ ] 修复 `/admin/tasks` key warning。
- [ ] 同步记录错误分级中文化。
- [ ] 复习/搜索空状态补 CTA。
- [ ] 文章列表移动端卡片化。

## 9. 第三阶段详细 TodoList
- [ ] 重建 visual snapshots。
- [ ] 为危险操作搭建临时库 E2E profile。
- [ ] 扩展 RBAC 真实隔离测试矩阵。
- [ ] 增加 onboarding checklist。
- [ ] 设计 CI 分层门禁。

## 10. 每个任务完成定义
- 有代码改动
- 有测试
- 有文档
- 有截图或页面验证
- 有 Playwright 或人工验收记录
