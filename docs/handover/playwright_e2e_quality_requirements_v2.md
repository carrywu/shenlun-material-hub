# Playwright E2E 测试规范 v2（企业级/社区推荐）

## 1. 全局原则

1. **完整阅读项目代码**：在写测试前，必须扫描项目中所有页面、路由、组件、表单、按钮、弹窗、Tab、菜单、上传/生成/删除/筛选/分页/刷新等用户交互元素。
2. **生成交互组件清单**：列出 `interactive-components-list.md`，每个组件必须有对应测试。
3. **禁止假装通过**：找不到元素必须抛错，禁止 swallow 异常或过宽 selector。

---

## 2. 用户可点击元素截图源

1. 自动截图页面，将所有可点击元素识别并记录到 `clickable-elements-map.md`。
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

## 5. 高级覆盖与检查（社区推荐）

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
3. 如果使用 fallback，必须有明确注释说明。

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

1. `docs/testing/interactive-components-list.md`
2. `docs/testing/clickable-elements-map.md`
3. `docs/testing/playwright-coverage-report.md`
4. 报告必须包含：
   - 覆盖页面与组件
   - 未覆盖组件及原因
   - 发现的真实 bug
   - 失败测试详情
   - 运行方式
```bash
pnpm test:e2e
pnpm playwright test
pnpm playwright show-report
```

---

## 9. 建议流程

1. 生成 TodoList → 扫描代码 → 生成组件与可点击元素地图
2. 编写测试 → 测试覆盖率统计 → 修复 Bug → 再运行测试
3. 输出验收报告
4. 对核心业务流程进行人工 Review
