# Playwright E2E 测试规范 v2

> 本规范适用于项目所有 Playwright E2E 测试。新测试必须遵循，旧测试逐步迁移。

## 1. 全局原则

1. **完整阅读项目代码**：在写测试前，必须扫描项目中所有页面、路由、组件、表单、按钮、弹窗、Tab、菜单、上传/生成/删除/筛选/分页/刷新等用户交互元素。
2. **生成交互组件清单**：列出 `docs/testing/interactive-components-list.md`，每个组件必须有对应测试。
3. **禁止假装通过**：找不到元素必须抛错，禁止 swallow 异常或过宽 selector。

---

## 2. 用户可点击元素截图源

1. 自动截图页面，将所有可点击元素识别并记录到 `docs/testing/clickable-elements-map.md`。
2. 包括：
   - button、a、input、select、textarea
   - role=button / role=link
   - cursor:pointer / onClick 元素
   - 图标按钮、菜单项、卡片点击区
3. 每个元素都必须有测试点击行为，并做结果断言。

---

## 3. 断言与验证

1. 每次操作后必须验证结果：
   - 页面状态变化
   - Toast / 弹窗 / modal
   - 数据新增/修改/删除
   - 表单校验
   - 列表变化 / 分页 / 筛选
   - 路由跳转
2. 示例：
```ts
await page.getByRole('button', { name: '保存' }).click()
await expect(page.getByText('保存成功')).toBeVisible()
```

---

## 4. 覆盖正常、异常和边界路径

1. 核心功能至少测试：
   - 正常成功流程
   - 必填项为空
   - 接口失败
   - 无数据状态
   - 加载中状态
   - 重复点击 / 快速点击
   - 权限不足 / 未登录
   - 表单非法输入
   - 删除取消 / 确认

---

## 5. 高级覆盖与检查

1. **Route Coverage**：保证每条路由都被访问并测试。
2. **Component Coverage**：保证每个关键组件至少一次被触发。
3. **User Journey Coverage**：核心业务流程完整测试。
4. **Network Mock & Error**：接口模拟异常，验证前端响应。
5. **Console Error**：测试中禁止出现 JS 错误。
6. **Accessibility (a11y)**：检测页面可访问性。
7. **Visual Regression**：对比截图差异。
8. **Dead Link / Empty Page**：检查死链和空白页。
9. **CRUD & 全链路**：增删改查操作全流程验证。
10. **权限矩阵测试**：不同用户角色访问不同功能。
11. **加载状态检查**：验证 loading、Skeleton、占位等 UI 状态。
12. **快速连续点击 & 异步流程**：验证多次操作不会破坏数据或 UI。

---

## 6. Fallback 使用规范

1. 仅允许多语言兼容或 DOM 不稳定场景。
2. 禁止通过 fallback 掩盖真实 bug。
3. 如果使用 fallback，必须有明确注释说明原因。

### 禁止的 fallback 模式

```ts
// ❌ 禁止：空数据时跳过测试
if (!articleId) { test.skip(); return; }

// ❌ 禁止：找不到元素时静默通过
if (await firstCard.count() > 0) { /* ... */ }

// ❌ 禁止：不验证结果的宽泛断言
await expect(page.locator('body')).toBeVisible();
```

### 允许的 fallback 模式

```ts
// ✅ 允许：找不到就报错
const articleId = await ensureArticleExists(baseURL);

// ✅ 允许：验证 API 返回并 throw
const res = await fetch(`${baseURL}/api/explore?pageSize=1`);
if (!res.ok) throw new Error(`API 返回 ${res.status}`);
const json = await res.json();
if (!json.data?.length) throw new Error('没有测试数据，请先 seed');
```

---

## 7. 测试失败处理

1. 失败时自动保存：
   - screenshot
   - video
   - trace
   - console error
   - network error
   - 当前 URL / DOM
2. Playwright 配置：
```ts
use: {
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

---

## 8. 最终交付物

1. `docs/testing/interactive-components-list.md` — 交互组件清单
2. `docs/testing/clickable-elements-map.md` — 可点击元素地图
3. `docs/testing/playwright-coverage-report.md` — 覆盖率报告
4. 报告必须包含：
   - 覆盖页面与组件
   - 未覆盖组件及原因
   - 发现的真实 bug
   - 失败测试详情
   - 运行方式

```bash
pnpm exec playwright test
pnpm exec playwright show-report
```

---

## 9. 建议流程

1. 生成 TodoList → 扫描代码 → 生成组件与可点击元素地图
2. 编写测试 → 测试覆盖率统计 → 修复 Bug → 再运行测试
3. 输出验收报告
4. 对核心业务流程进行人工 Review

---

## 10. 共享工具规范

### 登录工具 `e2e/helpers/auth.ts`

所有 spec 必须使用统一登录工具，禁止 inline 写登录逻辑：

```ts
import { loginAsAdmin } from './helpers/auth';

// 使用
await loginAsAdmin(page);
```

### 数据确保工具 `e2e/helpers/seed.ts`

测试需要数据时，通过 API 确保数据存在，找不到就 throw：

```ts
import { ensureArticleExists, ensureCardExists } from './helpers/seed';

// 使用
const articleId = await ensureArticleExists(baseURL); // 找不到就 throw
```

### Console Guard `e2e/helpers/consoleGuard.ts`

遇到以下错误直接 throw，不允许静默通过：
- React key warning
- Hydration failed
- Unhandled Runtime Error
- TypeError / ReferenceError
- Cannot read properties of
- NEXT_NOT_FOUND

---

## 11. Selector 规范

1. 优先使用 `getByRole`、`getByLabel`、`getByPlaceholder`
2. 禁止使用 `page.locator('text=...')` 等模糊匹配
3. 禁止使用 CSS class selector（如 `.btn-primary`）除非无其他选择
4. 禁止使用 XPath

```ts
// ✅ 推荐
await page.getByRole('button', { name: '保存' }).click();
await page.getByPlaceholder('请输入账号').fill('admin');
await page.getByLabel('密码').fill('admin123');

// ❌ 禁止
await page.locator('.btn-primary').click();
await page.locator('text=保存').click();
await page.locator('//button[contains(text(), "保存")]').click();
```

---

## 12. Spec 文件命名与组织

1. 每个 spec 文件对应一个页面或一组紧密相关的页面
2. 文件名与路由路径对应
3. `test.describe` 命名为中文，描述页面名称

```
e2e/
├── helpers/
│   ├── auth.ts              # 共享登录工具
│   ├── seed.ts              # 测试数据确保工具
│   └── consoleGuard.ts      # 控制台错误监控
├── auth.spec.ts             # 认证 + 导航 + 注册
├── middleware.spec.ts       # 路由重定向
├── data-isolation.spec.ts   # 数据隔离 + 权限
├── articles.spec.ts         # 文章列表
├── article-detail.spec.ts   # 文章详情
├── cards.spec.ts            # 素材卡
├── sources.spec.ts          # 来源管理
├── explore-discover.spec.ts # 探索 + 发现
├── search.spec.ts           # 搜索
├── review.spec.ts           # 复习
├── admin.spec.ts            # 管理后台（仪表板/任务/日志/用户/备份/清洗）
├── ai-config.spec.ts        # AI 配置
├── wewe-rss.spec.ts         # WeWe RSS 集成
└── settings.spec.ts         # 用户设置
```
