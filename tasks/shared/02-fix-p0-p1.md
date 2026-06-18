# Task 02: Fix P0/P1

## Input

Use the latest full audit report.

## Rules

- Fix only P0/P1.
- Fix one root cause at a time.
- Add or update tests.
- Do not skip failing tests.
- Do not change unrelated code.
- Do not rewrite broad modules.
- Preserve existing behavior unless it conflicts with `docs/agent/final-requirements.md`.

## Required Flow

1. Reproduce issue.
2. Identify root cause.
3. Output TodoList.
4. Apply smallest safe fix.
5. Run targeted tests.
6. Run standard validation.
7. Report files changed, tests run, results, risks, and not-tested gaps.
