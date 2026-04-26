---
name: house-platform-release-check
description: Run a pre-release safety checklist for house-platform deployments. Use before merging to main, creating a release, or deploying admin/listings/prisma/AI changes.
---

# House Platform Release Check

## Goal
Catch deployment and runtime issues before production rollout.

## Apply this skill when
- User asks "可以上線嗎", "幫我檢查 deploy", "release 前看一下".
- Changes include `prisma`, `src/app/api`, auth, storage, or AI provider configuration.

## Required checklist
1. **Build safety**
   - `npm run lint`
   - `npm run build`
2. **Database safety**
   - Prisma schema and migrations are consistent.
   - No duplicate or conflicting migrations.
3. **Runtime config**
   - Required env vars exist for touched features.
   - If AI is touched: check `AI_PROVIDER`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_CHAT_CONTEXT_TURNS`, `AI_ULTRA_SAVING_MODE`.
4. **Auth and routing**
   - Admin routes require session guard.
   - Public routes still accessible as expected.
5. **API sanity**
   - Changed API routes return clear error messages.
   - No accidental secret leakage in responses/logs.
6. **Rollback readiness**
   - Identify highest-risk file(s) and quickest rollback handle.

## Output format
- Release verdict: `Ready` / `Ready with caution` / `Not ready`
- Findings ordered by severity:
  - Critical blockers
  - Warnings
  - Nice-to-have fixes
- Minimal go-live test plan (3-8 checks)

## Guardrails
- Prefer concrete evidence (command output, route behavior).
- Do not claim "ready" without build-level signal.
