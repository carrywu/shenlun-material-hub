# Harness Review

你正在评审 `shenlun-material-hub` 仓库。**只读，不修改任何文件。**

## Steps

1. 运行预检与状态：

```bash
pnpm harness:preflight
git status --short
git diff --stat
```

2. 按顺序阅读：

```text
docs/audit/requirements-confirmation.md
docs/audit/project-assessment.md
docs/audit/development-plan.md
docs/audit/development-todolist.md
docs/audit/development-handoff.md
docs/testing.md
docs/harness/contract.md
docs/harness/validation-matrix.md
```

3. 识别：

- P0 权限风险（越权 / ownerUserId 泄露 / env fallback / secret 泄露）
- P1 需求缺口（核心需求没满足 / 缺关键测试 / 私有状态没隔离）
- 缺失测试
- 过期文档
- 下一批 batch 的高风险区域

4. 仅输出报告，不要修改文件。

## 输出格式

```markdown
# Harness Review Report

## Scope

## P0 Findings

## P1 Findings

## Missing Tests

## Recommended Batch Order

## Do Not Touch Areas

## Next Prompt To Run
```

## 禁止事项

- 不要泛泛建议
- 不要说"看起来可以"
- 不要修改文件
- 不要把 P0 降级成建议
