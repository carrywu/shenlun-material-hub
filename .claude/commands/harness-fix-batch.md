# Harness Fix Batch

你正在 `shenlun-material-hub` 项目中修复一个 batch。

预期输入（参数 `$ARGUMENTS` 或直接给出路径）：

```text
{{BATCH_FILE_PATH}}
```

例如：

```text
tasks/harness/batch-a-sync-security.md
```

## Rules

- 先读必读文档，不要直接改代码。
- 读取指定 batch 文件。
- 编辑前必须输出 TodoList（Problem Summary / Current Behavior / Expected Behavior / Files To Inspect / Planned Changes / Tests To Add / Validation Commands / Risks / Rollback Plan）。
- 只修改 batch scope 内文件，除非明确说明理由。
- 改代码必须配套测试，或写明 Not-tested 原因。
- 运行必需验证命令（按改动类型选择 standard / e2e / db）。
- 更新 `docs/audit/development-handoff.md` 和 `docs/audit/development-todolist.md`。
- 不允许把失败测试 skip 掉。
- 不允许 AI / IMA fallback 到 env。
- 不允许绕过 ownerUserId 权限。
- 不删除用户私有资产。
- 不声称通过除非命令实际运行且退出码 0。

## 修改策略

1. 先修 API / service 层权限。
2. 再修前端入口显示。
3. 再补测试。
4. 最后更新 handoff / todolist。
5. 小步提交，不做大范围重构。

## 验证

按改动类型运行：

```bash
pnpm harness:preflight
pnpm lint
pnpm test
pnpm build
```

涉及 UI / auth / RBAC / owner 隔离时，按影响范围运行相关 Playwright spec：

```bash
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
```

改动影响多个主流程时运行全量：

```bash
pnpm exec playwright test
```

无法运行必须写清楚：`Not tested: 原因`、风险、人工验证步骤。

## 输出格式

```markdown
# Fix Batch Report

## Batch

## Summary

## Files Changed

## Tests Changed

## Commands Run

## Result

## Not Tested

## Remaining Risks

## Next Batch
```
