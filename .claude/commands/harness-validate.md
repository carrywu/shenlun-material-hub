# Harness Validate

运行 harness 验证脚本。参数 `$ARGUMENTS` 可选：`preflight` / `standard` / `e2e` / `db` / `diff <batch-file>`。默认 `preflight`。

## 用法

```bash
/harness-validate                  # 只读预检
/harness-validate standard         # lint + test + build
/harness-validate e2e              # standard + playwright 全量
/harness-validate db               # db:generate + db:setup:dry + standard
/harness-validate diff tasks/harness/batch-a-sync-security.md   # 检查 diff 是否越出 batch scope
```

## 规则

- 必须实际运行命令，不得声称通过除非退出码 0。
- 把每条命令的真实输出和退出码贴进报告。
- 失败必须分析根因，不要只贴日志。
- 失败的测试必须列出 spec 文件名和下一步动作。

## 输出格式

```markdown
# Validation Report

## Commands Run

| Command | Exit Code | Result |
|---|---|---|

## Evidence

（关键输出摘要）

## Failures

## Verdict
```
