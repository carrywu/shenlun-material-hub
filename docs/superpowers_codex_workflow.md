# Superpowers + Codex 工作流：需求核对、Bug 排查与后续开发

> 适用项目：`shenlun-material-hub` / 申论素材采集与学习系统  
> 目标：用 Superpowers 约束 Codex 的工作方式，形成稳定的工程化流程：**需求核对 → 系统排查 Bug → 分批修复 → 后续开发迭代**。

---

## 一、核心原则

不要直接让 Codex “把所有 bug 都修了”。更稳妥的方式是分阶段推进：

```text
第一轮：只做需求核对，不改代码。
第二轮：只做 bug 发现，不改代码。
第三轮：只修 P0/P1，不做新功能。
第四轮：补测试和交接文档。
第五轮：再开发新功能。
```

这样可以避免 Codex：

- 没核对需求就开始改代码；
- 为了让测试通过而降低断言质量；
- 没跑完整验证就声称完成；
- 把环境问题、测试噪声和真实业务 bug 混在一起；
- 一次性大改导致新 bug。

---

## 二、Superpowers 在 Codex 里的用法

在 Codex 中可以通过 `$` 调用 skill，例如：

```text
$superpowers:systematic-debugging 查看下我这个项目有什么 bug
```

但建议不要只用一个 skill，而是组合使用：

```text
$superpowers:planning
$superpowers:systematic-debugging
$superpowers:test-driven-development
$superpowers:verification-before-completion
```

推荐职责：

| Skill | 用途 |
|---|---|
| `$superpowers:planning` | 需求核对、设计方案、拆 TodoList |
| `$superpowers:systematic-debugging` | 系统性复现、定位、归因 bug |
| `$superpowers:test-driven-development` | 先补测试，再修复代码 |
| `$superpowers:verification-before-completion` | 完成前强制验证，不能假装通过 |

---

## 三、阶段 A：需求核对，不准改代码

目标：让 Codex 先理解项目、整理需求、列出不确定点，再由人工确认。

### 给 Codex 的提示词

```text
$superpowers:planning

你先不要修改任何代码。

请基于当前 shenlun-material-hub 项目，完成一次“需求核对 + 项目现状理解”。

要求：
1. 阅读 AGENTS.md、CLAUDE.md、docs/、tasks/、package.json、prisma/schema.prisma、src/app、src/components、e2e、tests。
2. 已归档 archive/ archived/ old/ backup/ 目录不要读，除非当前文档引用。
3. 输出一份《需求核对清单》，按模块整理：
   - 用户端文章学习页
   - 文章详情页
   - 素材卡生成
   - AI 评估
   - 管理后台
   - 公众号/WeWe RSS
   - 采集源管理
   - RBAC/权限
   - 测试体系
   - 部署/环境变量
4. 每个模块必须列出：
   - 当前已实现
   - 代码证据路径
   - 疑似未实现
   - 疑似 bug
   - 需要我确认的问题
5. 不要做主观猜测。找不到证据就写“未找到证据”。
6. 不要修改代码，不要运行破坏性命令。
7. 最后给我一个“需要人工确认的问题列表”，每个问题提供 A/B/C 选项和你的推荐答案。
```

### 阶段产物

建议要求 Codex 输出：

```text
docs/audit/requirements-confirmation.md
docs/audit/project-module-map.md
```

---

## 四、阶段 B：系统找 Bug，先证据后结论

目标：建立验证基线，分类真实 bug、测试缺口、交互问题、权限问题和环境问题。

### 给 Codex 的提示词

```text
$superpowers:systematic-debugging

现在进入系统性 bug 排查阶段。先不要修复代码，除非我明确说可以修。

目标：找出当前项目真实存在的 bug、测试缺口、交互问题、权限问题和环境问题。

执行规则：
1. 先建立基线：
   - git status --short
   - pnpm lint
   - pnpm test
   - pnpm build
   - pnpm exec playwright test
2. 如果 Playwright 全量太慢，先跑关键路径：
   - 登录/登出
   - 文章列表
   - 文章详情
   - AI 评估
   - 素材卡生成
   - 管理后台用户管理
   - 管理后台日志
   - 采集源管理
   - RBAC 权限隔离
3. 所有失败必须记录：
   - 命令
   - 错误摘要
   - 完整错误栈关键行
   - 复现步骤
   - 影响页面/API
   - 可能根因
   - 证据文件路径
4. 发现 warning 也要记录，但要区分：
   - P0 阻断交付
   - P1 主要功能 bug
   - P2 体验/稳定性问题
   - P3 代码质量/可维护性问题
5. 不准只说“可能有问题”。必须给证据。
6. 不准修复代码。
7. 输出 docs/audit/bug-discovery-report.md 和 docs/audit/bug-todolist.md。
```

### 已知 Bug 线索

把下面这些线索直接交给 Codex 纳入排查：

```text
请把以下已发现问题纳入 bug-discovery-report.md，并继续补充证据：

1. Admin Users 创建用户：
   - API 创建成功，toast 显示成功，但表格中看不到新用户。
   - 疑似列表刷新、排序、分页或查询条件问题。

2. 素材卡详情跳转：
   - 点击素材卡后 URL 或详情标题断言失败。
   - 需要确认是路由、数据状态还是测试选择器问题。

3. AdminLogsPage React key warning：
   - data.map() 返回 fragment，但 key 可能放在内部 TableRow 而不是 Fragment 上。
   - 位置疑似 src/app/admin/logs/page.tsx。

4. PUT /api/admin/users/[id]：
   - 空 body 或坏 JSON 会触发 request.json() 的 Unexpected end of JSON input。
   - 应统一返回 400，而不是产生服务端异常日志。

5. pnpm lint：
   - 当前无 error，但有 18 个 unused warning。
   - 需要判断是否只是清理问题，还是逻辑遗漏。
```

---

## 五、阶段 C：分批修复，不要一次全改

第一批建议修复范围：

1. React key warning；
2. malformed JSON 返回 400；
3. Admin 用户创建后列表刷新/排序问题；
4. 素材卡详情跳转失败。

### 给 Codex 的提示词

```text
$superpowers:systematic-debugging
$superpowers:test-driven-development

现在允许修复第一批 bug，但必须小步提交。

修复范围只包括：
1. AdminLogsPage React unique key warning。
2. PUT /api/admin/users/[id] 空/坏 JSON body 应返回 400，不应抛 Unexpected end of JSON input。
3. Admin Users 创建用户成功后，列表必须能看到新用户，或 UI 明确跳到包含新用户的页。
4. 素材卡点击后必须进入系统内详情页，并且详情标题/内容断言稳定通过。

要求：
1. 每修一个 bug，先写或更新对应测试。
2. 修复后跑最小验证命令。
3. 一个 bug 一个 commit。
4. 每个 commit message 要清楚，例如：
   - fix(admin-logs): add stable fragment keys
   - fix(api-users): handle malformed json body
   - fix(admin-users): refresh list after create
   - fix(cards): stabilize detail navigation
5. 更新 docs/audit/bug-todolist.md，把完成项打勾。
6. 更新 tasks/ 下的交接文档，写清：
   - 修改了什么
   - 为什么这样改
   - 验证命令
   - 剩余风险
7. 修完第一批后运行：
   - pnpm lint
   - pnpm test
   - pnpm build
   - pnpm exec playwright test e2e/admin.spec.ts
   - pnpm exec playwright test e2e/cards.spec.ts
8. 如果全量 Playwright 太慢，不要假装通过；明确写“未完成全量 E2E”，并给出已验证范围。
```

---

## 六、阶段 D：后续开发，先需求冻结再实现

后续开发建议固定为：

```text
需求确认 → 设计方案 → TodoList → 测试计划 → 开发 → 自测 → E2E → 交接文档 → git commit
```

### 通用开发提示词

```text
$superpowers:planning
$superpowers:test-driven-development
$superpowers:verification-before-completion

我要继续开发 shenlun-material-hub。请按工程化流程执行。

本轮开发目标：
【这里写你的功能，比如：优化 WeWe RSS 管理员采集流程 / 增加文章筛选 / 优化素材卡详情页 / 增加 AI 提示词配置页】

执行规则：
1. 先不要改代码，先输出实现方案和需求核对。
2. 方案必须包含：
   - 涉及页面
   - 涉及 API
   - 涉及数据库字段/迁移
   - 涉及权限/RBAC
   - 涉及测试
   - 可能破坏的旧功能
3. 生成精细 TodoList，颗粒度要小到可以逐项打勾。
4. 我确认后再开发。
5. 开发时每完成一个小任务：
   - 更新 TodoList
   - 跑相关测试
   - 必要时提交 git
6. 所有 UI 文案必须中文。
7. 不允许删除历史数据。
8. 不允许绕过权限。
9. 不允许为了让测试通过而降低断言质量。
10. 完成后必须运行：
    - pnpm lint
    - pnpm test
    - pnpm build
    - 相关 Playwright E2E
11. 输出最终交接文档，包含：
    - 已完成
    - 未完成
    - 验证证据
    - 风险
    - 下一步建议
```

---

## 七、可直接发给 Codex 的总控提示词

```text
$superpowers:planning
$superpowers:systematic-debugging
$superpowers:test-driven-development
$superpowers:verification-before-completion

你现在接手 shenlun-material-hub 项目。我要和你完成一套完整的工程化工作流：需求核对 → bug 发现 → 分批修复 → 后续开发规划。

重要规则：
1. 第一阶段只做需求核对，不修改代码。
2. 第二阶段只做 bug 排查，不修改代码。
3. 第三阶段等我确认后，才允许修复 P0/P1 bug。
4. 第四阶段再规划后续功能开发。
5. 所有结论必须有代码路径、测试命令或运行日志作为证据。
6. 找不到证据就写“未找到证据”，不要猜。
7. 不准为了测试通过而降低断言质量。
8. 不准跳过失败测试后声称完成。
9. 每完成一个明确修复点，都要更新 TodoList，并建议一个 git commit。
10. 所有文档写入 docs/audit/ 或 tasks/ 当前日期目录。

第一阶段任务：需求核对

请阅读：
- AGENTS.md
- CLAUDE.md
- package.json
- prisma/schema.prisma
- src/app
- src/components
- src/lib
- src/server 或 src/api 相关目录
- e2e
- tests
- docs 中未归档文档
- tasks 中最近交接文档

不要读取 archive/ archived/ old/ backup/，除非当前文档明确引用。

输出：
1. docs/audit/requirements-confirmation.md
2. docs/audit/project-module-map.md

requirements-confirmation.md 必须包含：
- 模块名称
- 当前理解的需求
- 已实现证据
- 未实现/不确定点
- 需要我确认的问题
- 你的推荐答案

模块至少包括：
- 用户登录/权限
- 文章列表
- 文章详情
- AI 评估
- 素材卡生成
- 素材卡详情
- 管理后台用户管理
- 管理后台日志
- 采集源管理
- WeWe RSS / 公众号采集
- 系统配置 / AI 配置
- 数据隔离 / RBAC
- 测试体系
- 部署配置

第二阶段任务：bug 发现

完成需求核对后，开始系统性 bug 排查，但仍然不要修改代码。

请运行：
- git status --short
- pnpm lint
- pnpm test
- pnpm build
- pnpm exec playwright test

如果全量 Playwright 太慢，必须至少跑关键路径：
- 登录/登出
- 文章列表
- 文章详情
- 素材卡生成
- 素材卡详情跳转
- 管理后台用户管理
- 管理后台日志
- 采集源管理
- RBAC 权限隔离

把发现的问题写入：
1. docs/audit/bug-discovery-report.md
2. docs/audit/bug-todolist.md

bug-discovery-report.md 必须按优先级分类：
- P0：阻断交付/数据安全/权限绕过/构建失败
- P1：核心功能不可用
- P2：体验问题/稳定性问题
- P3：代码质量/警告/可维护性问题

每个 bug 必须包含：
- 标题
- 优先级
- 复现步骤
- 失败命令
- 错误摘要
- 相关文件路径
- 初步根因
- 建议修复方向
- 建议测试方式

请把以下已知线索纳入排查：
1. Admin Users 创建用户成功，toast 成功，但表格没有显示新用户。
2. 素材卡点击后详情跳转或详情标题断言失败。
3. AdminLogsPage 存在 React unique key warning，疑似 map 返回 Fragment 但 key 位置错误。
4. PUT /api/admin/users/[id] 对空/坏 JSON body 会抛 Unexpected end of JSON input，应返回 400。
5. pnpm lint 有 unused warning，需要判断是否只是清理项还是逻辑遗漏。

停在 bug 报告阶段，不要继续修复。等我确认优先级。
```

---

## 八、推荐执行顺序

建议你这样和 Codex 配合：

1. 先发“总控提示词”；
2. 等 Codex 产出：
   - `requirements-confirmation.md`
   - `project-module-map.md`
   - `bug-discovery-report.md`
   - `bug-todolist.md`
3. 你人工确认需求和 bug 优先级；
4. 再让 Codex 修第一批 P0/P1；
5. 每批修复后强制跑测试；
6. 全部稳定后再进入新功能开发。

---

## 九、关键提醒

- 不要让 Codex 一次性大修。
- 不要让 Codex 未经确认就开发新功能。
- 不要跳过 Playwright 失败。
- 不要把 warning 完全忽略，至少要归档分类。
- 不要为了测试通过而降低断言。
- 每个 bug 都要有复现步骤、根因、修复、验证命令。
- 每轮都要更新交接文档。
- 每个可独立修复点建议单独 commit。
