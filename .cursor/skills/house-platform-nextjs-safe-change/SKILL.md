---
name: house-platform-nextjs-safe-change
description: Make safe Next.js changes in house-platform by checking framework-specific docs and avoiding deprecated patterns. Use when editing app routes, server/client boundaries, or Next config.
---

# House Platform Next.js Safe Change

## Goal
Reduce regressions caused by Next.js version differences and server/client boundary mistakes.

## Apply this skill when
- Editing files under `src/app/**`, `next.config.ts`, middleware/proxy, or route handlers.
- User asks for Next.js feature changes, routing updates, or API handler adjustments.

## Mandatory process
1. Identify touched area:
   - App Router page/layout
   - Route handler (`route.ts`)
   - Server vs client component boundary
   - Config/runtime behavior
2. Check relevant local Next docs in `node_modules/next/dist/docs/` before coding.
3. Prefer current official patterns for the installed version.
4. Keep server-only logic out of client components.
5. After edits, run lint/build-level validation when feasible.

## Common risk checks
- Incorrect `use client` placement or leaking server imports into client code.
- Route handler response shape inconsistency.
- Caching/revalidation behavior changes by accident.
- Deprecated config options in `next.config.ts`.

## Output format
- What changed
- Which Next.js docs area was consulted
- Risk notes (if any)
- Verification steps run / still pending

## Guardrails
- Do not introduce compatibility hacks without clear need.
- If uncertain about framework behavior, call it out and choose the safer conservative path.
