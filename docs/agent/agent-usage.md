# Agent Usage

## Codex

For audit:

```text
Read AGENTS.md and tasks/shared/01-full-audit-readonly.md.
Execute exactly.
Do not modify files.
Only audit, test, and report.
```

For fixes:

```text
Read AGENTS.md and tasks/shared/02-fix-p0-p1.md.
Use the latest audit report.
Fix only the first P0 issue.
```

Codex should use `AGENTS.md`, `docs/agent/*.md`, and `tasks/shared/*.md` as the shared source of truth. It should not depend on `.claude/commands/*`.

## Claude Code

Use the same shared files:

```text
Read AGENTS.md and tasks/shared/01-full-audit-readonly.md.
Execute exactly.
Do not modify files.
```

Optional Claude Code slash commands may wrap the same shared tasks:

```text
.claude/commands/full-audit.md
.claude/commands/fix-p0-p1.md
```

## Hermes

Use:

```text
按 AGENTS.md 和 tasks/shared/*.md 执行。
先输出 TodoList。
不要跳过验证。
```

## Principle

All agents read the same source of truth:

```text
AGENTS.md
docs/agent/final-requirements.md
docs/agent/validation-matrix.md
tasks/shared/*.md
```

Claude Code command files are wrappers only. Do not encode requirements exclusively in `.claude/commands/*`.
