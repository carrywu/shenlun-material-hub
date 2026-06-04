# Agent 浏览器验收工作流

## 流程

```
开发 Agent 完成代码修改
        ↓
自动运行 lint / test / build
        ↓
QA Agent 启动浏览器验收（Playwright E2E）
        ↓
截图 / trace / console logs 收集
        ↓
发现问题 → 固化为 Playwright E2E 测试
        ↓
用户最终抽查
```

## Agent 验收步骤

### Step 1: 基础验证

```bash
cd ~/Downloads/ima-shenglun-creators/shenlun-material-hub
pnpm lint
pnpm test
pnpm build
```

### Step 2: 启动 dev server

```bash
pnpm dev
# 等待 http://localhost:3001 可访问
```

### Step 3: 浏览器验收

使用 Playwright MCP 或 E2E 测试：

1. 打开关键页面
2. 像真人一样点击、输入、等待
3. 检查 loading / disabled 状态
4. 检查可见输出是否正确
5. 监听 console error 和 page error
6. 检查 API 请求是否成功

### Step 4: 结果收集

- 失败截图自动保存到 `test-results/`
- trace 保留完整的操作时间线
- console errors 通过 `e2e/helpers/consoleGuard.ts` 自动收集并附加到报告

### Step 5: 回归固化

发现的问题必须转化为 E2E 测试：

```typescript
import { test, expect } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test('critical flow should work', async ({ page }) => {
  const guard = attachConsoleGuard(page);

  await page.goto('/subscriptions');
  // ... 用户操作 ...

  // 检查无 critical console errors
  const criticals = guard.errors.filter(e =>
    /TypeError|ReferenceError|Hydration failed/i.test(e.text)
  );
  expect(criticals).toHaveLength(0);
});
```

### Step 6: 报告格式

Agent 最终报告必须包含：

| 项目 | 状态 |
|------|------|
| lint | ✅ / ❌ + 原因 |
| unit test | ✅ / ❌ + 失败详情 |
| build | ✅ / ❌ + 错误 |
| E2E test | ✅ / ❌ + 失败截图路径 |
| console errors | 数量 + 关键错误 |
| 浏览器截图 | 路径 |
| 未覆盖风险 | 说明 |

## 关键页面覆盖要求

| 页面 | 必须验证 |
|------|----------|
| `/integrations/wewe-rss` | 连接状态、同步操作、错误处理 |
| `/subscriptions` | 列表展示、搜索过滤、分页 |
| `/articles/[id]` | 正文渲染、AI 评分、素材卡 |
| `/materials` | 素材卡列表、筛选 |
| `/sources` | 来源管理、增删改 |
