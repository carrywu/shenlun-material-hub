# shenlun-material-hub 项目审计报告

## 1. 执行摘要
- 当前分支：`main`
- 当前 commit：`fb33bfa test: full project quality audit with 3 new E2E specs`
- 是否有未提交改动：有，本次新增 `docs/audit/**` 与 `tasks/2026-06-06-project-audit-and-next-plan/**`
- 审计结论：核心代码能 lint/test/build，但浏览器 E2E 全量不可用；前台文章流基本可读，素材卡与同步/AI 设置存在用户可见错误。
- 当前项目成熟度：内部开发可继续，体验闭环未完成。
- 是否适合继续开发：适合，但应先修复 P0/P1 稳定性与体验闭环。
- 是否适合部署：不建议直接部署给普通用户。
- 最大风险：Playwright 认证状态失效导致全量 E2E 不能作为回归门禁；同时 `/cards`、AI/IMA 设置和同步记录存在真实页面错误。

## 2. 项目定位评估
- 当前项目实际解决什么问题：采集申论相关公开文章，进行 AI 评估、素材卡生成、复习和 IMA 同步。
- 面向谁：普通考公学习用户、管理员/运营者、新上手配置者。
- 核心用户路径：找文章 -> 阅读详情 -> 生成/查看素材卡 -> 复习 -> 同步 IMA。
- 当前功能是否闭环：文章发现和阅读基本闭环；素材卡、复习、IMA 同步闭环不完整。
- 哪些功能已经可用：文章列表、发现/探索页、后台来源/任务/日志/用户/备份/清洗等页面可渲染；a11y 专项通过。
- 哪些功能只是半成品：素材卡列表为 0 且请求失败；卡片 CRUD 无可操作数据；同步记录暴露 IMA 404 失败；AI/IMA 设置接口存在 500。

## 3. 真实页面体验评估
| 页面 | 体验评分 | 主要问题 | 优先级 | 建议 |
|---|---:|---|---|---|
| `/articles` | 7 | 有 439 篇文章，表格信息密集，移动端横向压力大 | P1 | 增加移动卡片布局和更清晰的详情入口 |
| `/articles/[id]` | 4 | 定向审计首篇详情出现错误标记，E2E 多处找不到 h1 | P0 | 修复详情页加载/标题语义并补稳定 seed |
| `/cards` | 2 | 显示 0 张且“请求失败”，空状态不可行动 | P0 | 修复 API/空状态，提供生成素材卡入口 |
| `/discover` | 7 | 内容丰富，但 visual baseline 失效 | P2 | 更新视觉基线，限制截图策略 |
| `/explore` | 7 | 内容丰富，但 visual baseline 失效 | P2 | 同上 |
| `/search` | 5 | 空状态提示基本可见，但依赖素材卡数据 | P1 | 空状态引导生成卡片 |
| `/review` | 5 | 无卡片时只有“太棒了”，不告诉新用户下一步 | P1 | 增加“去生成素材卡” CTA |
| `/settings/*` | 4 | AI/IMA 设置捕获 500 错误 | P0 | 修复配置接口与错误提示 |
| `/admin` | 7 | 页面可渲染，指标明确 | P1 | 先修复 E2E 认证门禁 |
| `/admin/tasks` | 5 | React key warning | P1 | 修复表格 row key |
| `/admin/sync-records` | 4 | 可见 IMA 404 失败细节，普通用户难理解 | P1 | 结构化失败原因和修复建议 |
| `/admin/settings/ai` | 4 | 捕获 500 资源错误 | P0 | 修复提示词/配置读取异常 |
| `/admin/integrations/wewe-rss` | 7 | 页面可渲染，适合作为运营入口 | P2 | 危险同步动作补 dry-run E2E |
| 移动端 | 4 | 文章表格和后台布局可读性不足 | P1 | 前台移动优先，后台至少避免遮挡 |

## 4. 用户路径评估

### 普通考公用户路径
- 入口：首页会导到登录或顶部导航，不够像学习产品首页。
- 关键操作：文章列表、发现、探索可浏览；卡片/复习依赖素材卡数据。
- 卡点：文章详情/素材卡错误，生成入口不清晰，0 卡片状态不能指导下一步。
- 建议：优先修复文章详情和素材卡 API，再补“从文章生成卡片 -> 复习”的首屏工作流。

### 管理员路径
- 入口：后台页面可渲染，导航清晰。
- 关键操作：来源、任务、日志、AI、WeWe RSS、用户、备份、清洗入口齐全。
- 卡点：E2E 认证失效；AI 设置 500；任务页 key warning；危险操作没有在临时库完整验证。
- 建议：先恢复可回归的 admin E2E，再处理 AI/IMA/同步错误。

### 新用户路径
- 入口：缺少 onboarding 和“先配置什么”的工作流提示。
- 关键操作：配置 AI、来源、采集、生成卡片、同步 IMA。
- 卡点：设置项解释不足，空状态没有下一步按钮，错误多为技术信息。
- 建议：增加设置首页 checklist 和每个空状态的明确 CTA。

## 5. 技术架构评估
- 前端：Next.js App Router + React 19，前后台页面分区清晰，但部分页面复用导致前台路由呈现后台 shell。
- 后端/API：API route 数量较多，admin/user/public 边界基本存在，但 route tests 不能覆盖真实认证状态。
- 数据库：Prisma 7 + PostgreSQL；schema 包含 User、Source、ContentItem、MaterialCard、SyncRecord、AiConfig、SystemLog、AsyncTask 等主链路模型。
- AI：AI Key 使用加密存储，缺少密钥时会抛出中文错误；当前页面捕获到 AI 设置 500。
- 采集：WeWe RSS sidecar 边界清楚，源码与 docker-compose 注释强调只读消费。
- 异步任务：有 AsyncTask 与轮询工具；后台任务页存在 React key warning。
- IMA 同步：同步记录保留失败信息，但错误暴露底层 API 路径，不利于用户修复。
- WeWe RSS：管理入口可访问；同步/删除类动作本次未真实写入验证。
- 测试：Vitest 通过；Playwright 规格完整但全量门禁失败。

## 6. 安全与权限评估
- RBAC：admin API 多数使用 `requireAdmin`，用户侧 API 使用 `requireAuth`/`requireVerifiedUser`。
- 数据隔离：已有 owner/visibility 设计和 RBAC 风险登记；legacy null-owner 策略仍需实测矩阵。
- public API：前台文章可见，但未登录访问部分 API 会产生 401 console error。
- admin API：认证 helper 和 storageState 不稳定，导致测试落回登录页。
- 图片代理：本次未发现专门图片代理 SSRF 证据，仍建议列入 P2 专项。
- AI Key：`src/lib/crypto.ts` 加密依赖 `AI_CONFIG_ENCRYPTION_KEY`；缺失密钥会导致配置/读取失败风险。
- 破坏性操作：备份、清洗、删除、禁用等入口存在，但本次按约束未做真实写入，需要临时库验证。

## 7. 测试现状
| 测试类型 | 当前状态 | 是否运行 | 结果 | 建议 |
|---|---|---|---|---|
| `pnpm install` | 可用 | 是 | 通过，pnpm 11 warning | 迁移 `pnpm.onlyBuiltDependencies` 到新配置 |
| `pnpm lint` | 可用 | 是 | 通过，8 warnings | 清理 unused warnings |
| `pnpm test` | 可用 | 是 | 249 passed | 保持 |
| `pnpm build` | 可用 | 是 | 通过，78 static pages | 保持 |
| Playwright 全量 | 不可用 | 是 | 20 failed 后停止 | P0 修复认证/storageState |
| visual regression | 部分可用 | 是 | 12 passed / 2 failed | 更新 `/explore`、`/discover` 基线策略 |
| a11y | 可用 | 是 | 24 passed | 加入 CI 门禁 |
| dead-link | 误报严重 | 是 | 10 failed 后停止 | 不要用 body 全文查 `404` |
| console guard | 部分覆盖 | 是 | 发现 500/key warning | 扩展到全路由 |

## 8. 发现的问题清单
| ID | 问题 | 类型 | 影响 | 严重级别 | 证据 | 建议 |
|---|---|---|---|---|---|---|
| AUD-001 | Playwright 全量 admin 测试认证失效 | 测试/质量 | 回归门禁不可用 | P0 | `pnpm exec playwright test --max-failures=20` | 重做 global setup/storageState |
| AUD-002 | `/cards` 显示请求失败 | 产品/API | 素材卡闭环中断 | P0 | `docs/audit/screenshots/cards-desktop.png` | 修复 `/api/material-cards` 与空状态 |
| AUD-003 | AI/IMA 设置请求 500 | API/配置 | 新用户无法配置核心能力 | P0 | `admin-authenticated-results.json` consoleIssues | 修复配置读取和缺失密钥提示 |
| AUD-004 | 文章详情页不稳定 | 产品/API | 普通用户阅读路径中断 | P0 | `articles-cmpzaad...desktop.png`、E2E 详情失败 | 修复详情数据和 h1 语义 |
| AUD-005 | dead-link spec 误报 | 测试 | 无法判断真死链 | P1 | `body.textContent()` 命中 Next dev 404 脚本 | 改为 status + 可见 not-found 容器 |
| AUD-006 | visual baseline 高度不一致 | 测试 | 视觉回归不可稳定使用 | P2 | `/explore`、`/discover` expected 720 vs actual 2800+ | 统一 fullPage/viewport 截图策略 |
| AUD-007 | `/admin/tasks` React key warning | 前端质量 | console guard 失败风险 | P1 | consoleIssues | 修复 table row key |
| AUD-008 | 同步记录暴露底层 IMA API 404 | UX | 用户无法理解如何修复 | P1 | `/admin/sync-records` 文本 | 映射为中文诊断和修复 CTA |

## 9. 产品体验问题
| ID | 页面/流程 | 问题 | 用户影响 | 建议 | 优先级 |
|---|---|---|---|---|---|
| UX-001 | 素材卡 | 0 张卡片时显示请求失败，无生成入口 | 用户不知道下一步 | 空状态提供“去文章生成素材卡” | P0 |
| UX-002 | 复习 | 无卡片时只说太棒了 | 新用户误以为完成 | 显示创建卡片引导 | P1 |
| UX-003 | 文章列表移动端 | 表格密集 | 手机学习困难 | 卡片式移动列表 | P1 |
| UX-004 | 设置 | 专业词解释不足 | 新用户配置困难 | 增加 checklist 和帮助文本 | P1 |
| UX-005 | 同步失败 | 暴露 API 404 | 运营排障困难 | 中文化错误分级 | P1 |

## 10. 技术债问题
| ID | 模块 | 问题 | 风险 | 建议 | 优先级 |
|---|---|---|---|---|---|
| TD-001 | E2E auth | storageState 不可靠 | CI 失真 | API 登录写 cookie 或统一 helper | P0 |
| TD-002 | AI config | 缺失加密密钥/配置异常处理不足 | 页面 500 | 降级为可读错误态 | P0 |
| TD-003 | MaterialCard API | 空数据/401/请求失败处理不一致 | 核心闭环断 | 修复 auth/owner/空状态 | P0 |
| TD-004 | Visual tests | 基线策略不统一 | flaky | 区分 viewport 与 fullPage | P2 |
| TD-005 | RBAC tests | mock 多，真实隔离不足 | 数据泄露回归 | 增加 A/B 用户 E2E/API 矩阵 | P1 |

## 11. 下一步开发方向建议
- 短期：修复 Playwright 认证、素材卡列表、文章详情、AI/IMA 设置 500。
- 中期：补齐普通用户学习闭环、空状态/onboarding、移动端阅读体验。
- 长期：强化 RBAC 数据隔离、CI 门禁、监控、Prompt 版本管理和采集扩展。

## 12. 结论
当前最应该先做的是恢复“可测试的核心学习闭环”：修复 E2E 认证门禁、文章详情和素材卡 API/空状态。

---

## 13. 2026-06-08 边界审计执行记录

> 本节记录新的持续执行目标：完整审查并修复前端、后端、接口、权限、采集流程、AI 流程、页面交互、异常处理、状态管理、测试体系中的边界问题。执行原则为先审查、分级，再按 P0 → P1 → P2 → P3 闭环修复。

### 13.1 当前执行状态

- 当前分支：`audit/boundary-hardening-2026-06-08`
- 初始工作区：干净；基于 `main...origin/main [ahead 14]` 创建专项分支。
- 当前交付结论：**未达到可交付标准**；P0/P1 边界问题仍待修复和验证。
- 追踪文档：`docs/audit/development-todolist-2026-06-08.md`
- 测试报告：`docs/testing/full-project-validation-report.md` 的 2026-06-08 章节。

### 13.2 问题总览

| ID | 优先级 | 问题 | 状态 | 影响范围 | Commit |
|---|---|---|---|---|---|
| SETUP-001 | P0 前置 | 建立审计报告、开发 todolist、交接文档、测试报告追踪 | 已完成 | docs / handoff | 本次文档初始化提交 |
| P0-001 | P0 | 素材卡生成缺少内容访问校验、重复判断未按 owner 隔离、异步任务未绑定 userId | 已完成 | generate-card API / async task | 本次 P0-001 修复提交 |
| P0-002 | P0 | `/api/sync` 状态/历史查询未按 owner scope 限制 | 已完成 | sync API / ima-sync service | 本次 P0-002 修复提交 |
| P1-001 | P1 | 手动内容导入 `sourceId` 缺失/无效会触发外键 500 | 已完成 | content-items API | 本次 P1-001 修复提交 |
| P1-002 | P1 | `/api/discover` 未合并 visibility/ownerUserId 过滤 | 已完成 | discover API / public feed | 本次 P1-002 修复提交 |
| P1-003 | P1 | 注册接口未校验 JSON 字段类型，部分审计路径记录明文邀请码 | 已完成 | register API / audit log | 本次 P1-003 修复提交 |
| P1-004 | P1 | 多个 API 使用 unsafe `parseInt`，malformed pagination 可能导致 Prisma NaN | 已完成 | API pagination | 本次 P1-004 修复提交 |
| P2-001 | P2 | 微信手动导入异常后 CollectorRun 可能停留 running | 已完成 | wechat import API | 本次 P2-001 修复提交 |
| P2-002 | P2 | 异步任务归属和可见性需全局扫尾 | 已完成 | async task / admin tasks | 本次 P2-002 扫尾提交 |
| P2-003 | P2 | 新增边界错误需在 UI 中有可读错误态与重复点击保护 | 未开始 | affected components | 待提交 |
| P3-001 | P3 | 交叉审计扫尾 | 进行中 | whole codebase | 已提交部分扫尾；FINAL-001 待提交 |
| P3-002 | P3 | 全量验证与最终交接 | 未开始 | validation / docs | 待提交 |

### 13.3 风险说明

- `/api/discover` 的产品语义按安全默认处理：保持公开 feed，但匿名只能看到 public/legacy 内容。
- legacy `ownerUserId: null` 数据沿用既有 helper 视为可访问，避免破坏历史数据；如需收紧，需要单独数据迁移和确认。
- 异步任务必须在入队前和执行时双重校验权限，避免延迟执行时出现边界漂移。
- Playwright 可能依赖本地数据库、种子数据和 sidecar；若环境导致失败，必须记录为环境/数据问题，不得声明通过。

### 13.4 当前交付结论

本轮仅完成计划和追踪文档初始化，尚未进入代码修复。项目当前仍需完成 P0/P1 修复、补充自动化回归、执行全量验证后，才能重新判断是否可交付。
