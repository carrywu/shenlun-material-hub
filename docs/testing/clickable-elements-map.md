# 可点击元素地图

> 自动生成于 2026-06-06，覆盖所有页面路由的可交互元素。

## /admin/login — 登录页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 1 | 账号输入框 | input | `getByPlaceholder('请输入账号')` | 可输入文字 | auth.spec.ts |
| 2 | 密码输入框 | input | `getByPlaceholder('请输入密码')` | 可输入文字 | auth.spec.ts |
| 3 | 登录按钮 | button | `getByRole('button', { name: '登 录' })` | 提交登录表单 | auth.spec.ts |

## / — 仪表板

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 4 | 导航链接（8个） | link | header nav links | 跳转对应页面 | auth.spec.ts |
| 5 | 管理后台链接 | link | `getByRole('link', { name: '管理后台' })` | 跳转 /admin | auth.spec.ts |
| 6 | 登出按钮 | button | logout form button | 清除 cookie 跳转登录页 | auth.spec.ts |
| 7 | 采集按钮 | button | CollectButton | 打开采集对话框 | (未测试) |

## /articles — 文章列表

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 8 | 关键词搜索 | input | `getByPlaceholder('搜索标题、正文、来源')` | 输入关键词 | articles.spec.ts |
| 9 | 来源类型下拉 | select | `[data-testid="source-type-select"]` | 展开选项 | articles.spec.ts |
| 10 | 文章来源下拉 | select | `[data-testid="source-name-select"]` | 展开选项 | articles.spec.ts |
| 11 | AI 评估状态下拉 | select | combobox | 展开选项 | articles.spec.ts |
| 12 | 搜索按钮 | button | `getByRole('button', { name: '搜索' })` | 执行搜索 | articles.spec.ts |
| 13 | 重置按钮 | button | `getByRole('button', { name: '重置' })` | 重置筛选 | articles.spec.ts |
| 14 | 高级筛选切换 | button | `getByRole('button', { name: '高级筛选' })` | 展开/收起 | articles.spec.ts |
| 15 | 刷新按钮 | button | `getByRole('button', { name: '刷新' })` | 重新加载 | articles.spec.ts |
| 16 | 表格行 | row | table row click | 打开详情面板 | articles.spec.ts |
| 17 | 分页 | button | pagination buttons | 翻页 | articles.spec.ts |
| 18 | (管理模式) 开始采集 | button | `getByRole('button', { name: '开始采集' })` | 触发采集 | articles.spec.ts |
| 19 | (管理模式) AI 评估 | button | `getByRole('button', { name: 'AI 评估' })` | 触发评估 | articles.spec.ts |
| 20 | (管理模式) 调试切换 | button | `getByRole('button', { name: '🐛 调试' })` | 切换调试列 | articles.spec.ts |

## /articles/[id] — 文章详情

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 21 | 收藏按钮 | button | bookmark toggle | 切换收藏状态 | article-detail.spec.ts |
| 22 | 已读按钮 | button | read toggle | 切换已读状态 | article-detail.spec.ts |
| 23 | 查看原文 | link | `getByRole('link', { name: '查看原文' })` | 打开外部链接 | article-detail.spec.ts |
| 24 | AI 评估按钮 | button | AI assess button | 触发 AI 评估 | article-detail.spec.ts |
| 25 | 图片 | img | article content images | 打开预览 overlay | article-detail.spec.ts |
| 26 | 关闭预览 | button | preview close button | 关闭 overlay | article-detail.spec.ts |

## /cards — 素材卡列表

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 27 | 搜索 | input | search input | 输入搜索词 | cards.spec.ts |
| 28 | 确认筛选按钮 | button | 全部/已确认/未确认 | 过滤卡片 | cards.spec.ts |
| 29 | 卡片类型 tab | tab | type tabs | 切换类型 | cards.spec.ts |
| 30 | 卡片点击 | card | MaterialCardView | 跳转 /cards/{id} | cards.spec.ts |
| 31 | 确认切换 | button | confirm/unconfirm | 改变确认状态 | cards.spec.ts |
| 32 | 删除 | button | delete button | 确认后删除 | cards.spec.ts |
| 33 | 批量选择 | checkbox | card checkbox | 选中/取消 | cards.spec.ts |
| 34 | 分页 | button | pagination | 翻页 | cards.spec.ts |

## /cards/[id] — 素材卡详情

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 35 | 编辑按钮 | button | edit button | 打开编辑器 | cards.spec.ts |
| 36 | 重新生成 | button | regenerate button | 触发重新生成 | (未测试) |
| 37 | 确认切换 | button | confirm toggle | 改变状态 | cards.spec.ts |
| 38 | 同步 IMA | button | sync button | 触发同步 | (未测试) |
| 39 | 删除 | button | delete button | 删除卡片 | cards.spec.ts |

## /explore — 探索区

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 40 | 搜索 | input | search input | 过滤卡片 | explore-discover.spec.ts |
| 41 | 平台筛选 | select | platform select | 过滤 | explore-discover.spec.ts |
| 42 | 类型筛选 | select | content type select | 过滤 | explore-discover.spec.ts |
| 43 | 卡片点击 | card | article card | 跳转 /articles/{id} | explore-discover.spec.ts |
| 44 | 查看原文 | link | external link | 打开外部 | explore-discover.spec.ts |
| 45 | 分页 | button | pagination | 翻页 | explore-discover.spec.ts |

## /discover — 发现页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 46 | 平台筛选 | select | platform select | 过滤 | explore-discover.spec.ts |
| 47 | 类型筛选 | select | content type select | 过滤 | explore-discover.spec.ts |
| 48 | 信任等级筛选 | select | trust level select | 过滤 | explore-discover.spec.ts |
| 49 | 收藏 | button | bookmark toggle | 切换收藏 | explore-discover.spec.ts |
| 50 | 已读 | button | read toggle | 切换已读 | explore-discover.spec.ts |
| 51 | 刷新 | button | refresh button | 重新加载 | explore-discover.spec.ts |

## /search — 搜索页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 52 | 搜索输入 | input | search input | 输入关键词 | search.spec.ts |
| 53 | 卡片类型 | select | card type select | 过滤 | search.spec.ts |
| 54 | 确认状态 | select | confirmed select | 过滤 | search.spec.ts |
| 55 | 搜索按钮 | button | search button | 执行搜索 | search.spec.ts |
| 56 | 清除筛选 | button | clear button | 重置 | search.spec.ts |
| 57 | 结果卡片点击 | card | result card | 跳转 /cards/{id} | search.spec.ts |

## /review — 复习页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 58 | 模式选择 | select | mode select | 切换模式 | review.spec.ts |
| 59 | 卡片类型 | select | card type select | 过滤 | review.spec.ts |
| 60 | 刷新 | button | refresh button | 重新加载 | review.spec.ts |
| 61 | 展开/折叠 | button | section toggle | 展开/收起内容 | review.spec.ts |
| 62 | 标记已复习 | button | mark reviewed button | 标记完成 | review.spec.ts |

## /admin — 管理后台首页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 63 | 刷新 | button | refresh button | 重新加载 | admin.spec.ts |
| 64 | 统计卡片 | link | stat card links | 跳转子页面 | admin.spec.ts |

## /admin/tasks — 异步任务

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 65 | 搜索 | input | search input | 过滤任务 | admin.spec.ts |
| 66 | 状态筛选 | select | status select | 过滤 | admin.spec.ts |
| 67 | 类型筛选 | select | type select | 过滤 | admin.spec.ts |
| 68 | 任务行展开 | row | task row click | 展开详情 | admin.spec.ts |

## /admin/logs — 系统日志

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 69 | 级别筛选 | select | level select | 过滤 | admin.spec.ts |
| 70 | 类别筛选 | select | category select | 过滤 | admin.spec.ts |
| 71 | 清除旧日志 | button | clear button | 删除旧日志 | (未测试) |

## /admin/users — 用户管理

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 72 | 创建用户 | button | create user button | 打开对话框 | admin.spec.ts |
| 73 | 禁用/启用 | button | toggle button | 改变状态 | admin.spec.ts |
| 74 | 重置密码 | button | reset password button | 打开对话框 | (未测试) |
| 75 | 删除用户 | button | delete button | 删除用户 | (未测试) |

## /admin/backup — 数据备份

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 76 | 导出 | button | export button | 下载备份 | admin.spec.ts |
| 77 | 上传 | input | file upload | 选择文件 | (未测试) |
| 78 | 预览恢复 | button | dry-run button | 预览 | (未测试) |
| 79 | 确认恢复 | button | apply button | 执行恢复 | (未测试) |

## /admin/clean — 数据清洗

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 80 | 规则勾选 | checkbox | rule checkboxes | 选择规则 | admin.spec.ts |
| 81 | 执行清洗 | button | execute button | 打开确认框 | admin.spec.ts |
| 82 | 确认/取消 | button | dialog buttons | 执行或取消 | admin.spec.ts |

## /admin/settings/ai — AI 配置

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 83 | 保存 | button | save button | 保存配置 | ai-config.spec.ts |
| 84 | 测试连接 | button | test button | 测试 API | ai-config.spec.ts |
| 85 | 删除配置 | button | delete button | 删除 | (未测试) |

## /admin/integrations/we-mp-rss — we-mp-rss

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 86 | 测试连接 | button | test button | 测试连接 | we-mp-rss.spec.ts |
| 87 | 预览同步 | button | preview button | 预览 | we-mp-rss.spec.ts |
| 88 | 同步来源 | button | sync button | 同步 | we-mp-rss.spec.ts |

## /settings — 设置首页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 89 | 账号设置链接 | link | link to /settings/account | 跳转 | settings.spec.ts |
| 90 | AI 配置链接 | link | link to /settings/ai | 跳转 | settings.spec.ts |
| 91 | IMA 同步链接 | link | link to /settings/ima | 跳转 | settings.spec.ts |

## /settings/account — 账号设置

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 92 | 当前密码 | input | password input | 输入 | settings.spec.ts |
| 93 | 新密码 | input | password input | 输入 | settings.spec.ts |
| 94 | 确认密码 | input | password input | 输入 | settings.spec.ts |
| 95 | 提交 | button | submit button | 提交修改 | settings.spec.ts |

## /settings/ima — IMA 设置

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 96 | 添加目标 | button | add button | 打开表单 | settings.spec.ts |
| 97 | 表单输入 (5个) | input | form inputs | 输入配置 | settings.spec.ts |
| 98 | 创建 | button | create button | 创建目标 | (未测试) |
| 99 | 删除 | button | delete button | 删除目标 | (未测试) |

## /register — 注册页

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 100 | 账号输入 | input | username input | 输入 | auth.spec.ts |
| 101 | 密码输入 | input | password input | 输入 | auth.spec.ts |
| 102 | 邀请码输入 | input | invitation code input | 输入 | auth.spec.ts |
| 103 | 注册按钮 | button | submit button | 提交注册 | auth.spec.ts |
| 104 | 登录链接 | link | link to /admin/login | 跳转登录 | auth.spec.ts |

## AdminShell 侧边栏

| # | 元素 | 类型 | Selector | 点击后预期 | 测试文件 |
|---|------|------|----------|-----------|---------|
| 105 | 折叠切换 | button | collapse toggle | 折叠/展开 | auth.spec.ts |
| 106 | 11个导航链接 | link | sidebar nav links | 跳转各管理页面 | auth.spec.ts |
| 107 | 返回前台 | link | link to / | 跳转首页 | (未测试) |
| 108 | 登出 | button | logout button | 登出 | auth.spec.ts |

---

## 汇总

| 指标 | 数值 |
|------|------|
| 总可点击元素 | 108 |
| 已有测试覆盖 | ~85 |
| 未覆盖 | ~23（标记为 (未测试)） |
| 覆盖率 | ~79% |
