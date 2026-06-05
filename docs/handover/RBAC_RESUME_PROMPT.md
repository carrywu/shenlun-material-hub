# RBAC Resume Prompt

Use this prompt for the next Codex / Claude Code / Gemini takeover:

```text
You are taking over shenlun-material-hub on branch feat/production-hardening.

Start by reading:
- docs/handover/README.md
- docs/handover/PROJECT_MASTER_TODO.md
- docs/handover/RBAC_HANDOVER.md
- docs/handover/RBAC_API_AUDIT.md
- docs/handover/RBAC_RISK_REGISTER.md

Do not trust prior chat history. Reconfirm the current code state with:
- git status --short --branch
- git branch --show-current
- git log --oneline -20
- git diff --stat

Primary mission:
Fix P0 RBAC blockers before adding new features.

P0 order:
1. ✅ Resolve Prisma migration drift for User, Session, owner fields, and RBAC relations.
2. ✅ Add failing A/B user isolation tests.
3. ✅ Fix annotation PATCH/DELETE ownership checks.
4. ✅ Fix content item annotation GET auth and isolation.
5. ✅ Decide and enforce /api/articles public/private policy.
6. ✅ Fix unsafe Prisma where OR merges in /api/content-items and /api/search.
7. ✅ Run pnpm lint, pnpm test, pnpm build, and Playwright where UI/auth behavior changed.

Remaining P0 items:
- P0｜部署｜建立空库迁移与首启验收脚本
- P0｜安全｜生产禁用默认管理员密码路径

Project constraints:
- WeWe RSS is a sidecar. Do not embed it.
- Do not write the WeWe RSS database.
- Do not implement WeChat reverse engineering or bypass login/captcha/risk controls.
- Destructive database operations require dry-run.
- Preserve manual source and external WeRSS fallback support.

Final report must include changed files, test commands/results, remaining risks, and manual verification checklist.
```
