# 项目审计 TodoList

审计日期：2026-06-06

## 1. 项目状态
- [x] 检查 Git 状态
- [x] 检查 package.json
- [x] 检查文档入口
- [x] 检查测试配置
- [x] 检查 Prisma schema
- [x] 检查 docker-compose
- [x] 检查 Playwright 配置
- [x] 检查是否已有 visual regression
- [x] 检查是否已有 a11y
- [x] 检查是否已有 dead-link

## 2. 真实页面
- [x] 启动项目
- [x] 登录后台
- [x] 查看前台首页
- [x] 查看文章列表
- [x] 查看文章详情
- [x] 查看素材卡
- [x] 查看管理后台
- [x] 查看 AI 配置
- [x] 查看 WeWe RSS
- [x] 查看移动端

## 3. 用户体验
- [x] 普通考公用户路径
- [x] 管理员路径
- [x] 新用户路径
- [x] 空状态
- [x] 错误状态
- [x] loading 状态
- [x] 中文 UI
- [x] 移动端体验
- [x] 视觉体验

## 4. 技术审计
- [x] 架构审计
- [x] 数据库审计
- [x] RBAC 审计
- [x] public API 审计
- [x] 图片代理/SSRF 审计
- [x] AI Key 安全审计
- [x] 异步任务审计
- [x] 备份恢复审计
- [x] WeWe RSS 审计
- [x] IMA 同步审计

## 5. 测试
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm build
- [x] Playwright E2E
  - 结果：失败，`--max-failures=20` 后停止；20 failed / 3 interrupted / 216 did not run / 26 passed。
- [x] 视觉回归
  - 结果：失败，12 passed / 2 failed；`/explore`、`/discover` baseline 高度与实际 full-page 高度不一致。
- [x] a11y
  - 结果：通过，24 passed。
- [x] dead-link
  - 结果：失败，10 failed 后停止；主要为测试读取 `body.textContent()` 命中 Next dev 内联 404 字符串的误报。
- [x] console error 检查
  - 结果：定向浏览器审计捕获 `/admin/settings/ai`、`/settings/ai`、`/settings/ima` 500 资源错误，以及 `/admin/tasks` React key warning。

## 6. 输出
- [x] 生成 project-audit-report.md
- [x] 生成 next-development-plan.md
- [x] 生成 development-todolist.md
- [x] 更新 handoff / journal / validation

## 7. BLOCKED / 不完整交互说明
- BLOCKED: 生成素材卡、重新生成素材卡、编辑/保存/删除素材卡未完整点击验证。原因：当前素材卡列表为 0 且 `/cards` 显示“请求失败”，没有可安全操作的卡片数据。下一步唯一行动：先修复 `/api/material-cards`/空状态，再用临时库或 seed 数据执行卡片 CRUD E2E。
- BLOCKED: 来源新增/编辑/删除、WeWe RSS 执行同步、用户禁用、备份导出、数据清洗执行未做真实写入。原因：审计要求禁止生产/真实状态写入，且这些操作有数据副作用。下一步唯一行动：准备 dry-run/临时库 Playwright profile 后再执行破坏性路径。
- BLOCKED: 表单登录在自定义脚本中未稳定跳转，API 登录成功。下一步唯一行动：修复 Playwright auth setup/storageState，并统一所有 E2E 使用同一个登录 helper。
