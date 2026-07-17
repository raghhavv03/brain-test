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
   - `20260714_trials_unique.sql`
4. `npm run dev` — open [http://localhost:3000](http://localhost:3000).
5. Optional: `npx playwright install chromium` (once) to run the e2e suite.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (static generation + a route-graph-scoped typecheck — see caveat below) |
| `npm run typecheck` | `tsc --noEmit` — checks every file `tsconfig.json` includes, e.g. test files. Run this separately; `npm run build` alone does not catch type errors in files the app's routes never import (see CLAUDE.md's HOW TO WORK). |
| `npm run lint` | ESLint |
| `npm test` | Vitest (scoring-engine unit tests) |
| `npm run test:e2e` | Playwright — standing e2e suite, all 5 games + results live against dev server + Supabase (`tests/e2e/`) |

## Current status

See CLAUDE.md's "Current Status" section and `docs/project-reference.md` §10 for the full build-order table. Phases 0–3 are done (all five games, sequence wrapper, scoring engine, results screen, and a standing Playwright e2e suite — §9h). Phase 4 (polish/PWA) is closed: all five games skinned, all five core shell pages built (Home/Science/About/Product/Privacy & Disclaimer), the shell↔lab transition (both directions), the responsive pass (4.3, 3 bugs fixed), and the PWA manifest (4.5 — installable manifest, placeholder icons, no service worker) are all done and verified — §9i. Carried-forward gaps: Content/Blog page (deferred, later SEO phase) and a real-phone check of the shell pages/manifest (emulated viewports only so far).

Two post-launch production incidents on already-shipped code — an iOS Safari session-integrity data loss, and a follow-up where the fix's own halt policy cost a full run over one dropped save — were found and fixed. See `docs/project-reference.md` §9e/§9f.
