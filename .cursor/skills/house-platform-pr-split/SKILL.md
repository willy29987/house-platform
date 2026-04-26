---
name: house-platform-pr-split
description: Split large house-platform changes into small reviewable pull requests. Use when the working tree is large, mixed-domain, or when the user asks to reduce review risk and merge conflicts.
---

# House Platform PR Split

## Goal
Turn a large mixed change set into small PRs that are easy to review, test, and roll back.

## Apply this skill when
- User asks to "拆 PR", "分批上", "降低衝突", or "整理 commit".
- `git status` shows many files across multiple domains (`prisma`, `admin`, `frontend`, `ai-team`, docs).

## Standard split order
1. **Foundation**: dependencies, config, prisma schema/migrations, shared infra.
2. **Admin auth/shell**: admin login, auth middleware/proxy, session guard.
3. **Admin business domain**: listings CRUD/export/users workflows.
4. **Public UX domain**: search/listing detail/inquiry and related UI components.
5. **AI/content domain**: `ai-team`, content draft pipeline, team orchestration.
6. **Docs-only cleanup**: README/DEPLOYMENT/.gitignore adjustments.

## Workflow
1. Inspect changed files and group by domain.
2. Propose 3-6 PR buckets with clear dependency order.
3. Keep each PR independently testable.
4. Avoid mixing migrations with unrelated UI changes unless strictly required.
5. Include risk notes per PR (schema risk, auth risk, SEO/public regression risk).

## Output format
- PR plan table in bullets:
  - PR name
  - Files/globs included
  - Why this boundary
  - Minimal test plan

## Guardrails
- Never force-push protected branches.
- Never include secrets (`.env`, keys, credentials).
- If branch already has mixed staged/unstaged changes, call it out and suggest re-staging steps.
