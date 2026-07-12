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
built, logic-verified against real Supabase data, reviewed.
Phase 3 is DONE. 3.1 (sequence wrapper, /test), 3.2 (scoring engine,
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
Phase 4 is in progress. The game-skin batch is DONE: Echo (signal-decoding
stream + a PrevFeedback chip resolving the previously-known feedback-overlap
issue), Circuit (glowing trail/node-board), and Lock-On (canvas orb-sprite +
trail/reticle skin, built for phone frame-rate headroom) are all skinned,
matching Trigger/Gatekeeper's established visual language — same onResult
display-hook pattern, same HUD/card grammar — not a new mechanism. All five
games are now visually and mechanically complete. Verified against live
Supabase data, including a follow-up sustained-play pass on Lock-On (7 live
rounds) specifically checking mark_ms_measured/motion_ms_measured for
drift under repeated play — none found. See docs/project-reference.md §4
and the new §9d for full detail, including a known verification gap (K-level
diversity wasn't achievable via the browser-automation tool) and an
unrelated pre-existing type-fixture bug found and fixed alongside this work
(insights.test.ts — see §9d; a `npm run typecheck` script now exists
specifically so this class of gap doesn't recur).
Shell pages are now the active Phase 4 work, governed by three locked
design-system decisions in docs/project-reference.md §8a: the site-wide
palette split (calm light shells vs. the existing dark lab, with a designed
shell↔lab transition), the landing-hero constraints (placeholder 3D bottle,
swap-in-ready, poster fallback + reduced-motion, mobile performance as a
hard budget not a nice-to-have), and the placeholder-copy rule (all shell
copy `[PLACEHOLDER]`-tagged, no fabricated testimonials/citations/claims —
a liability guard given the neurosurgery credibility the brand rests on).
Scope split: this session covers the three core shells (Home incl. the 3D
hero, Science, About); Product, Privacy, and Blog are deferred to a later
pass. Responsive pass and PWA manifest come after that.
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
- `next build` passing is not proof of a clean typecheck — it only checks files reachable from the app's route import graph, so test files (and anything else unimported) can hide real type errors. Run `npm run typecheck` separately before treating something as verified.
- After a working step, I commit to Git before we continue.
- Never hard-code secrets. Use .env for Supabase keys.
- If unsure, ask. Explain anything I might not understand.
