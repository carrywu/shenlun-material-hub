# Batch D: Validation and CI Cleanup

## Goal

让验证可复现，杜绝伪通过。

## Scope

```text
docs/testing.md
scripts/harness/*
package.json
playwright.config.*
vitest.config.*
tests setup files
docs/audit/development-handoff.md
docs/audit/development-todolist.md
```

## Requirements

### D1. Harness 脚本

确认存在（harness 落地任务应已创建，本批次负责收口 / 完善）：

```text
scripts/harness/preflight.mjs
scripts/harness/validate.mjs
scripts/harness/check-diff.mjs
```

### D2. package scripts

确认存在：

```json
{
  "harness:preflight": "node scripts/harness/preflight.mjs",
  "harness:validate": "node scripts/harness/validate.mjs standard",
  "harness:validate:e2e": "node scripts/harness/validate.mjs e2e",
  "harness:validate:db": "node scripts/harness/validate.mjs db"
}
```

### D3. 验证日志

每个任务应记录：

```markdown
## YYYY-MM-DD HH:mm

- Command:
- Result:
- Evidence:
- Notes:
```

### D4. 杜绝伪通过

如果某命令未运行，报告：

```text
Not tested: 原因
```

不得声称通过。

### D5. docs/testing.md 引用 harness

`docs/testing.md` 应引用 harness 命令（`pnpm harness:preflight` / `harness:validate`），并说明 standard / e2e / db 三种模式如何选用。

## Validation

```bash
pnpm harness:preflight
pnpm harness:validate
```

## Done When

- 脚本存在且可运行。
- package.json 脚本存在。
- `docs/testing.md` 引用 harness 命令。
- `development-handoff.md` 说明如何运行验证。
