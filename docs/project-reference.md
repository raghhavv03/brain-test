# Project Reference — Cognitive Brain Test

Full spec. Feed sections to Claude Code on demand per phase — don't keep this whole file in context every prompt. CLAUDE.md (root) is the only persistent file.

---

## 1. Background & Goal

Nutraceutical brand (cognitive-performance supplement) launching. Core credibility asset: founder is a practicing neurosurgeon. This app is the top-of-funnel engagement tool — a visitor takes a short cognitive test, gets an honest "brain score," and is routed toward the product where truthful to do so.

**Guiding principle: honest, not rigged.** A test secretly built to make everyone score badly would destroy the one asset the whole brand depends on (the neurosurgeon's credibility) and invite regulatory trouble. Honesty converts better with this audience than manipulation.

## 2. Scope (v1)

One responsive Next.js codebase, installable as a PWA. No native app. Two zones:
- **Calm shell** — restrained, trustworthy marketing/credibility pages.
- **Lively lab** — the interactive game zone (dark theme, animated).

Funnel: land → play test → see score → email capture + placeholder product CTA.

Standalone project — no integration with any other website. Agency's product-site integration happens later, by your dad's team.

## 3. Tech Stack

| Tool | Role |
|---|---|
| Next.js (App Router) + TypeScript | Pages, routing, UI |
| Tailwind CSS | Styling |
| shadcn/ui | Pre-built components, restyled |
| Framer Motion | Transitions, micro-animations |
| Supabase (Postgres) | Raw trials, results, leads |
| Recharts | Domain radar chart |
| Vercel | Hosting / deploy |
| PostHog | Funnel analytics (Phase 5) |
| `performance.now()` | High-precision timing |

One stack for everything. Games differ in art/logic, not technology. Only Lock-On needs extra animation care.

## 4. The Games (Segment A battery — Performance Seekers)

Universal loop: **show stimulus → time response → record → repeat.** Five skins on top.

**Priority 1 — Trigger (Reaction Time)** · build first
- Measures: processing speed. Skin: reflex console, needle sweep for speed.
- Fixed skeleton: random 1–3s foreperiod before each signal; log RT + errors; ~20–30 trials.

**Priority 2 — Gatekeeper (Go/No-Go)**
- Measures: impulse control. Skin: authorize frequent "friendlies," resist rare "hostiles."
- Fixed skeleton: ~80% go / ~20% no-go; primary measure = commission errors.

**Priority 3 — Echo (N-back)**
- Measures: working memory. Skin: signal-decoding stream / lighting grid, 2-back match.
- Fixed skeleton: steady fixed interval between items; clear match rule; log hits/false alarms; adaptive level allowed, score consistently.

**Priority 4 — Circuit (Trail-Making B)**
- Measures: task-switching. Skin: glowing trail connecting nodes 1→A→2→B→3→C, timed.
- Fixed skeleton: must alternate number/letter; wrong taps corrected not skipped; log time + errors.

**Priority 5 — Lock-On (Multiple Object Tracking)** · showpiece, build last
- Measures: divided attention. Skin: orbs blend after marking, drift, user re-identifies.
- Fixed skeleton: targets visually identical to distractors after marking; unpredictable non-looping motion; log accuracy/max K.
- **High complexity — test on real mid-range Android early.**

## 5. Features (beyond the games)

- Entry + segment question (v1 defaults to Performance Seeker).
- Universal measurement engine — build once (Phase 1), reuse for all 5 games.
- Practice round before each scored game.
- Sequence wrapper — one "Cognitive Performance Lab" flow, progress bar, shared session_id.
- Scoring engine — raw trials → domain sub-scores → headline Brain Score + band label. **Self-relative/descriptive only in v1 — no percentiles** (no norm data yet). Save raw data so scoring can be recomputed later.
- Results screen — headline score, domain radar, one genuine strength + one growth area, honest product tie-in, email capture, shareable result card.
- Placeholder product CTA — links nowhere yet; a later team wires it to the agency site.
- Privacy + disclaimer — consent line, visible "not a medical test."
- Analytics events (Phase 5): start, per-game complete, finish, email, CTA click.

## 6. Animations & Juice

Framer Motion. Restrained in the shell, lively in the lab. Micro-feedback on every correct response; smooth stage transitions; between-stage performance meter. **Phase 4 — never let polish precede correct measurement.** A great-looking mistimed game is worse than an ugly correctly-timed one.

## 7. Website Structure

| Page | Zone | Purpose |
|---|---|---|
| Home / Landing | Shell | Hook + "Take the Brain Test" CTA |
| The Brain Test | Lab | Intro → 5 games → results |
| Your Results | Lab | Score, radar, strength/growth, CTA, email, share |
| The Science / How It Works | Shell | Credibility: neurosurgeon, validated paradigms, honesty stance |
| About | Shell | Founder story, mission |
| Product | Shell | Placeholder — links out, wired later |
| Privacy & Disclaimer | Shell | Consent, "not a medical test" |
| Content / Blog | Shell | SEO — later phase |

## 8. Design System

- Principle: **calm shell, lively lab** — resolves "interactive but not too much."
- Color: off-white bg, near-black text, one accent (clinical blue or vital green). Dark "lab" mode for games.
- Type: one clean sans (Inter default; Geist/Satoshi for character). Max two typefaces.
- Spacing: generous, consistent scale.
- Components: shadcn/ui base, restyled.
- **Design tokens set up day one** in Tailwind config.
- Mobile-first, always.
- Placeholders to fill: brand name, exact palette, font, domain.

## 9. Data Model (Supabase)

Raw data always kept.
- `sessions` — id, created_at, segment, user_agent, consent.
- `trials` — id, session_id, game, trial_index, stimulus, response, **rt_ms**, correct, discarded, created_at. *(The scientific record — never skip.)*
- `results` — id, session_id, sub_scores (jsonb), headline_score, band_label, computed_at.
- `leads` — id, session_id, email, created_at, cta_clicked.

Enable Row Level Security — a session should only write its own trials.

## 10. Build Order

| Phase | Goal | Definition of done |
|---|---|---|
| **0 — Foundations** | Live empty site | Next.js+Tailwind+shadcn deployed to Vercel; design tokens set; Supabase project created |
| **1 — Engine + Trigger** ⭐ | One game measuring + saving correctly | Universal loop verified in Supabase (believable RTs, correct discard logic); skinned as Trigger |
| **2 — Rest of battery** | All 5 games | Gatekeeper, Echo, Circuit reuse engine; Lock-On tested on real phone; each saves clean data |
| **3 — Flow + scoring + results** | Complete funnel | Sequence wrapper; scoring engine (self-relative); results screen + radar + email + share; first Playwright e2e test |
| **4 — Polish + PWA** | Feels pro, works on phones | Real-device testing; animations; installable PWA; accessibility + reduced-motion |
| **5 — Integration + handoff** | Live + connected | Analytics wired; norm data accumulating; full review pass; measurement/claims handed to doctor+dev team |

## 11. Testing & Verification Protocol

- Does it run? No console errors, feature works end-to-end.
- **Check the DATA, not just the screen** — open Supabase: believable RTs (~200–500ms)? No impossible values? Discarded trials flagged correctly?
- Did anything else break? Click through other games/pages.
- Real phone check (Lock-On from Phase 2; all games by Phase 4).
- Run `pr-review-toolkit` on any commit touching measurement/scoring logic, and at each phase-end QA pass.
- Use the Playwright-based testing skill (from `example-skills`) for end-to-end checks, Phase 3 onward.
- Only then `git commit` with a real message.

## 12. Skills & Plugins in Use

Project skills (`.claude/skills/` — should be committed to repo; currently at personal scope, migrate before handoff):
- `cognitive-task-builder` — game logic, timing, trial data.
- `brand-design-system` — UI, styling, animation.
- `data-verification` — pre-commit checks, testing setup.

Installed plugins (user scope):
- `pr-review-toolkit` — review gate before measurement-logic commits and phase-end QA. Don't overuse on trivial changes — 12 agents, real token cost.
- `example-skills` (`anthropic-agent-skills` marketplace) — includes the Playwright web-app testing skill.

## 13. Token-Efficiency Working Protocol

- Persistent context = CLAUDE.md only. Feed this reference on demand, per phase.
- One task per prompt.
- Reference files by path; don't paste whole files unless needed.
- Commit + fresh session between features/phases.
- Reuse the engine for games 2–5 — don't regenerate.
- Paste error messages directly for fast fixes.
- Ask for a plan before code, and the simplest version.
- Reserve `pr-review-toolkit` for measurement-logic commits and phase-end QA, not every trivial change.

## 14. What "v1" Realistically Means

**In v1:** Performance Seeker flow, all five games, honest self-relative scoring, results + email capture + share, responsive + PWA, deployed.

**Deferred (correctly):** percentiles (need accumulated norms), brain-fog & healthy-aging segments, blog/SEO, deep scientific validation and final claim/legal review (doctor/dev team's job), product-site CTA wiring.

Ship the beachhead. Don't try to build the whole vision in one pass.
