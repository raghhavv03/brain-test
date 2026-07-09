# Project: Cognitive Brain Test (consumer funnel for a nutraceutical brand)
 
A responsive web app (installable as a PWA) where users play short cognitive
games, get an honest "brain score," and are routed toward the product.
Audience for v1: Performance Seekers (professionals + competitive-exam students).
 
## Stack
Next.js (App Router) + TypeScript · Tailwind · shadcn/ui · Framer Motion ·
Supabase (Postgres) · Vercel · Recharts (results chart). Timing: performance.now().
Vitest for scoring-engine unit tests.

## Current Status (see docs/project-reference.md §10 for the full build-order table)
Phases 0-2 done: all five games (Trigger, Gatekeeper, Echo, Circuit, Lock-On)
built, logic-verified against real Supabase data, reviewed. Skins done for
Trigger and Gatekeeper; pending for Echo, Circuit, Lock-On (deferred as a
batch to Phase 4, for visual consistency with the sequence wrapper).
Phase 3 in progress: 3.1 (sequence wrapper, /test) and 3.2 (scoring engine,
src/lib/scoring/) are both done. 3.1 built the intro → practice+scored ×5
games → complete flow, added a client-minted run_id (uuid, one per
full-sequence attempt) and an is_practice flag (excluded from scoring),
resolved the repeat-play/session_id policy from §9b, and was verified
against live Supabase data across two real runs (one abandoned mid-sequence,
one completed) — confirmed no run_id cross-contamination and that the
practice-row filter has real, sometimes large, effects on domain scores.
3.2 has 34 Vitest tests plus two real-data verification passes (a clean
5-domain run and a broken 3-domain run with insufficient-data handling).
Not yet started: 3.3 (results screen) — next up.
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
- `example-skills` (anthropic-agent-skills) — includes a web-app testing skill
  (Playwright-based). Use it for end-to-end checks in Phase 3 onward.
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
- After a working step, I commit to Git before we continue.
- Never hard-code secrets. Use .env for Supabase keys.
- If unsure, ask. Explain anything I might not understand.
