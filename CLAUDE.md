# Project: Cognitive Brain Test (consumer funnel for a nutraceutical brand)
 
A responsive web app (installable as a PWA) where users play short cognitive
games, get an honest "brain score," and are routed toward the product.
Audience for v1: Performance Seekers (professionals + competitive-exam students).
 
## Stack
Next.js (App Router) + TypeScript · Tailwind · shadcn/ui · Framer Motion ·
Supabase (Postgres) · Vercel · Recharts (results chart). Timing: performance.now().
 
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
