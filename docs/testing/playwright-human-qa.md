# Playwright 人工 QA 指南

## 启动项目

```bash
cd ~/Downloads/ima-shenglun-creators/shenlun-material-hub
pnpm dev
# 默认运行在 http://localhost:3001
```

## 运行 Playwright 测试

```bash
# 运行所有 E2E 测试
pnpm exec playwright test

# 运行指定文件
pnpm exec playwright test e2e/subscriptions-wewe-rss.spec.ts

# 带 UI 模式（交互式调试）
pnpm exec playwright test --ui

# 带 headed 模式（看到浏览器）
pnpm exec playwright test --headed

# 运行单个测试
pnpm exec playwright test -g "should display subscriptions"
```

## 用 Codegen 录制真人操作

```bash
# 打开录制器，自动在浏览器中记录操作
pnpm exec playwright codegen http://localhost:3001

# 指定输出文件
pnpm exec playwright codegen --output e2e/my-test.spec.ts http://localhost:3001
```

录制后会生成可直接运行的 Playwright 测试代码。

## 查看 Trace

```bash
# 打开最近一次测试的 trace
pnpm exec playwright show-trace test-results/*/trace.zip

# trace 文件在测试失败时自动保存到 test-results/ 目录
```

Trace 包含：
- 每一步操作的截图
- DOM 快照
- 网络请求
- 控制台日志
- 时间线

## 截图和视频

配置已启用：
- `screenshot: 'only-on-failure'` — 失败时自动截图
- `video: 'retain-on-failure'` — 失败时保留视频
- `trace: 'retain-on-failure'` — 失败时保留 trace

截图和视频保存在 `test-results/` 目录下。

## 查看 HTML 报告

```bash
pnpm exec playwright show-report
```

## 将手动验收变成 E2E 测试

1. 用 codegen 录制操作流程
2. 检查生成的代码，添加断言
3. 用 consoleGuard 监控 console.error
4. 保存为 `e2e/xxx.spec.ts`
5. 运行确认通过
6. 提交到版本库
