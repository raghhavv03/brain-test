# Cognitive Brain Test

A responsive Next.js web app (installable as a PWA) where users play five short cognitive games, get an honest "brain score," and are routed toward a nutraceutical brand's product. Built for a launch whose core credibility asset is a practicing neurosurgeon founder — the whole product depends on the scoring being honest, not rigged.

**Full spec and working history:** [`CLAUDE.md`](CLAUDE.md) (persistent context, read first) and [`docs/project-reference.md`](docs/project-reference.md) (full spec, fed to Claude Code per phase — not kept in context every prompt). Don't re-derive decisions already documented there.

## Stack

Next.js (App Router) + TypeScript · Tailwind · shadcn/ui · Framer Motion · Supabase (Postgres) · Recharts · Vitest. Timing via `performance.now()` on `requestAnimationFrame` — never `Date.now()`/`setTimeout` for measurement (see CLAUDE.md's non-negotiable science rules).

## Setup

1. `npm install`
2. Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. Apply the Supabase migrations in `supabase/migrations/` (in order) via the Supabase SQL editor — they are not applied automatically. As of this writing:
   - `20260710_run_id_is_practice.sql`
   - `20260711_results_run_id_unique.sql`
   - `20260712_leads_session_id_unique.sql`
4. `npm run dev` — open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (static generation + a route-graph-scoped typecheck — see caveat below) |
| `npm run typecheck` | `tsc --noEmit` — checks every file `tsconfig.json` includes, e.g. test files. Run this separately; `npm run build` alone does not catch type errors in files the app's routes never import (see CLAUDE.md's HOW TO WORK). |
| `npm run lint` | ESLint |
| `npm test` | Vitest (scoring-engine unit tests) |

## Current status

See CLAUDE.md's "Current Status" section and `docs/project-reference.md` §10 for the full build-order table. Phases 0–3 are done (all five games, sequence wrapper, scoring engine, results screen). Phase 4 is in progress: all five games are now fully skinned (Echo, Circuit, Lock-On skins landed and were verified against live Supabase data, matching Trigger/Gatekeeper's established visual language). Remaining in Phase 4: shell pages, responsive pass, PWA manifest.
