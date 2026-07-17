# Project: Cognitive Brain Test (consumer funnel for a nutraceutical brand)
 
A responsive web app (installable as a PWA) where users play short cognitive
games, get an honest "brain score," and are routed toward the product.
Audience for v1: Performance Seekers (professionals + competitive-exam students).
 
## Stack
Next.js (App Router) + TypeScript · Tailwind · shadcn/ui · Framer Motion ·
Supabase (Postgres) · Vercel · Recharts (results chart). Timing: performance.now().
Vitest for scoring-engine unit tests. Playwright (`@playwright/test`) for the
standing e2e suite — `npm run test:e2e` (tests/e2e/).

## Current Status (see docs/project-reference.md §10 for the full build-order table)
Phases 0-3 done: all five games built/skinned/verified against live Supabase
data; sequence wrapper, scoring engine, and results screen (score, radar,
insights, email capture, share card) all built and verified. Detail:
project-reference.md §3-§9c.

Phase 4 (polish/PWA) in progress. Shipped so far:
- All five games skinned to one visual system (§9d).
- All five core shell pages built: Home, Science, About, Product, Privacy &
  Disclaimer (§8a) — two-tag placeholder convention ([PLACEHOLDER] vs
  [PLACEHOLDER - LEGAL REVIEW]) established there.
- Shell↔lab transition, both directions: Home→/test entry sweep and the
  results→shell exit sweep, sharing one primitive
  (src/components/shell/zone-sweep.tsx). Both verified live, reduced-motion
  respected. Detail: §8a, §8b.
- Responsive polish pass (4.3, closed): every shell page, the /test
  sequence, all five games, and the results screen audited at 375/768/1280px
  via Playwright. Found and fixed 3 real bugs — Home hero tablet-width
  overflow, Circuit node crowding on mobile, Lock-On mobile tap-tolerance —
  all layout/hit-testing only, no science-rule surface touched.
  pr-review-toolkit clean; live-Supabase-verified (real Circuit/Lock-On runs
  plus a live results-screen check via CDP). Detail: §9g.
- Standing Playwright e2e suite (tests/e2e/, `npm run test:e2e`): drives all
  5 games' practice+scored rounds through to the results screen live against
  the dev server + real Supabase (RLS-respecting reads via a captured anon
  session JWT, never a service-role key). Each per-game helper recomputes
  its own ground truth rather than trusting the app. Detail: §9h.

Remaining Phase 4 scope: Content/Blog page (deferred, later SEO phase); the
PWA manifest; a real-phone check of all five shell pages, now also covering
the 4.3 responsive fixes (§11) — verified so far via emulated
viewports/Playwright only, not a physical device.

Two post-launch production incidents (iOS Safari session-integrity data
loss; an over-strict halt policy costing a full run on one dropped save)
were found and fixed outside the phase sequence — session-identity/save-
reliability hardening on already-shipped code, not games/scoring bugs.
Full detail: §9e, §9f. Test tables were truncated after each.

Read docs/project-reference.md for full detail on any past phase before
starting new work — don't re-derive decisions already made there.
 
## Skills & Plugins — use these whenever relevant, don't wait to be asked
Project skills (in .claude/skills/, auto-load, follow without exception):
- `cognitive-task-builder` — any game logic, timing, or trial-data work.
- `brand-design-system` — any UI, styling, or animation work.
- `data-verification` — before any commit touching games, timing, or scoring.
Installed plugins:
- `pr-review-toolkit` — run a review pass at the end of each phase, and any time
  a change touches measurement logic, before I commit.
- `example-skills` (anthropic-agent-skills) — Playwright web-app testing skill;
  mostly superseded now by the checked-in suite (`npm run test:e2e`, §9h).
MCP: a Supabase MCP server is connected (read-only, scoped to this project,
registered at user scope so it loads regardless of working directory) —
prefer it over the /dev/... debug-page pattern for reading data; it still
can't write (read-only), so migrations still go through the Supabase SQL
editor manually (see §9 in project-reference.md for the current migration list).
If a skill's guidance conflicts with a one-off request I make, flag the conflict
before proceeding rather than silently picking one.
 
## NON-NEGOTIABLE SCIENCE RULES (never change without asking me)
- Time responses with performance.now(), captured on requestAnimationFrame — never Date.now()/setTimeout for measurement.
- Discard any trial where the tab lost focus (Page Visibility API).
- ALWAYS save raw per-trial data (not just final scores) to Supabase.
- Task structure is fixed science; only the visuals/theme are flexible.
  Do not alter trial ratios, timing intervals, randomization, or task logic to "improve" a game.
- Never claim medical precision. This is not a medical test.
## HOW TO WORK
- Plan first: explain your approach and wait for my approval before writing code.
- One small feature per step. Build, then stop so I can test.
- Prefer the simplest solution. Don't add libraries without asking.
- Show me the diff; don't delete/rename files broadly without flagging it.
- `next build` passing is not proof of a clean typecheck — it only checks files reachable from the app's route import graph, so test files (and anything else unimported) can hide real type errors. Run `npm run typecheck` separately before treating something as verified.
- After a working step, I commit to Git before we continue.
- Never hard-code secrets. Use .env for Supabase keys.
- If unsure, ask. Explain anything I might not understand.
