---
name: house-platform-ai-cost-guard
description: Keep AI team features cost-efficient in house-platform. Use when changing AI models, prompts, orchestration depth, token settings, chat context, retries, or admin team routes under src/app/api/admin/team and src/lib/ai-team-*.
---

# House Platform AI Cost Guard

## Goal
Keep AI output useful while controlling API spend by default.

## Apply this skill when
- User asks to reduce cost, optimize token usage, or run in budget mode.
- Editing `src/lib/ai-team-server.ts`.
- Editing `src/app/api/admin/team/chat/route.ts` or `src/app/api/admin/team/orchestrate/route.ts`.
- Editing AI depth UI in `src/components/ai-team-panel.tsx` or AI setup copy in `src/app/admin/team/page.tsx`.

## Non-negotiable defaults
1. Prefer cheapest reliable model available in current provider.
2. Default depth is `quick` unless user explicitly requests broader coverage.
3. Enforce server-side guardrails; never rely on frontend only.
4. Keep generation bounded:
   - `AI_TEMPERATURE` default `0.35`
   - `AI_MAX_TOKENS` default around `700` (OpenAI-compatible) / `900` (Anthropic)
   - `AI_CHAT_CONTEXT_TURNS` default `10`
5. Keep concurrency conservative in orchestration.
6. Keep clear manual override path for quality mode (explicit opt-in).

## Change workflow
1. **Inspect current behavior**
   - Provider/model defaults
   - Token and temperature settings
   - Context window size
   - Orchestration depth and worker count
   - Retry/backoff and concurrency
2. **Apply least-disruptive savings**
   - Reduce defaults first, keep overrides via env vars.
   - Preserve UX copy to explain "cheap by default, upgrade when needed".
3. **Protect on backend**
   - If adding budget modes, enforce in API route logic.
4. **Validate**
   - Run lint checks for edited files.
   - Sanity-check no type errors in changed areas.
5. **Report**
   - Summarize cost impact, quality tradeoff, and rollback knobs.

## Output format for user updates
- What was changed (files and behavior)
- Why it reduces cost
- Expected quality impact (short and honest)
- Which env vars can tune it back up

## Guardrails
- Do not expose secrets.
- Do not hardcode API keys.
- Do not remove legal/risk role from fast orchestration without explicit user request.
