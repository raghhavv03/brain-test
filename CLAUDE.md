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
Phase 3 is now DONE. 3.1 (sequence wrapper, /test), 3.2 (scoring engine,
src/lib/scoring/), and 3.3 (results screen, src/components/results/) are all
built, verified against live Supabase data, and committed. 3.3 shipped in
two parts: (a) headline score + domain radar + strength/growth insights —
the radar's insufficient_data treatment (never rendered as zero, never as a
broken chart) was the main design problem, solved with a dashed/greyed
spoke+edge convention; (b) email capture (`leads`, one row per session via a
unique constraint + 23505 duplicate handling) and a shareable result-card
PNG (SVG string → canvas → Web Share API with a download fallback, feature-
detected via canShare() not just navigator.share existence, and pre-
rendered on mount to avoid Safari's user-activation timeout). Two real bugs
were caught by live-data verification and fixed before commit — see
docs/project-reference.md §9c for what they were and why static review
alone wouldn't have caught them.
Not yet started: Phase 4 (shell pages, remaining game skins, responsive +
PWA pass) — next up.
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
- After a working step, I commit to Git before we continue.
- Never hard-code secrets. Use .env for Supabase keys.
- If unsure, ask. Explain anything I might not understand.
