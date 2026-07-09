# Project Reference — Cognitive Brain Test

Full spec. Feed sections to Claude Code on demand per phase — don't keep this whole file in context every prompt. CLAUDE.md (root) is the only persistent file.

---

## 1. Background & Goal

Nutraceutical brand (cognitive-performance supplement) launching. Core credibility asset: founder is a practicing neurosurgeon. This app is the top-of-funnel engagement tool — a visitor takes a short cognitive test, gets an honest "brain score," and is routed toward the product where truthful to do so.

Guiding principle: honest, not rigged. A test secretly built to make everyone score badly would destroy the one asset the whole brand depends on (the neurosurgeon's credibility) and invite regulatory trouble. Honesty converts better with this audience than manipulation.

## 2. Scope (v1)

One responsive Next.js codebase, installable as a PWA. No native app. Two zones:
- Calm shell — restrained, trustworthy marketing/credibility pages.
- Lively lab — the interactive game zone (dark theme, animated).

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
| performance.now() | High-precision timing |
| Vitest | Unit tests for pure logic (scoring engine) |
| Playwright (via example-skills) | E2E checks, Phase 3 onward |

One stack for everything. Games differ in art/logic, not technology. Only Lock-On needed extra animation care (Canvas 2D, not DOM).

## 4. The Games (Segment A battery — Performance Seekers)

Universal loop: show stimulus → time response → record → repeat. Five skins on top. All five built, verified against real Supabase data, reviewed, committed.

Trigger (Reaction Time) — done (logic + skin)
- Measures: processing speed. Skin: reflex console, needle sweep for speed.
- Fixed skeleton: random 1-3s foreperiod; ~25 trials; 2500ms response deadline (miss classified by measured RT exceeding deadline, not race-order — a late-firing timer must not let an over-deadline response pass as valid).
- Response capture: Space key only (not arbitrary keydown — modifier keys like Shift must not register).

Gatekeeper (Go/No-Go) — done (logic + skin)
- Measures: impulse control. Skin: authorize frequent "friendlies," resist rare "hostiles."
- Fixed skeleton: 32 go / 8 no-go (fixed-count shuffle, not per-trial coin-flip, to guarantee exact ratio); primary measure = commission errors. rt_ms captured on both go-hits and no-go commission errors (not just go trials) — commission-error latency is itself diagnostic.

Echo (N-back) — done (logic; skin pending)
- Measures: working memory. Skin: signal-decoding stream, 2-back match.
- Fixed skeleton: 8-letter pool, steady fixed 2500ms SOA regardless of response timing (fire-and-forget capture — an early response must never shorten the interval), letter visible 500ms then blank. 24 items, exactly 7 forced/excluded targets (not probabilistic) so the true target rate is exact, not "roughly." Items 1-2 can never be targets (no 2-back reference yet). Classification: hit / miss / false_alarm / correct_rejection, recomputed from ground truth at runtime, not trusted from the generator.
- Known UX-only issue, deferred to skin pass: previous item's feedback text displays concurrently with current item's letter (by design, for continuous feedback) but isn't visually distinguished — needs a "Previous:" label or fade, not a logic fix.

Circuit (Trail-Making B) — done (logic; skin pending)
- Measures: task-switching. Skin: glowing trail connecting nodes 1-A-2-B-3-C, timed.
- Fixed skeleton: 16-node fixed alternating sequence (1-A-2-B-...-8-H); wrong taps never advance state (no skip-ahead, verified against deliberate ahead-of-sequence taps, not just any-wrong-node taps); already-tapped nodes stay tappable (disabling them would silently narrow what "error" measures). DOM buttons, not canvas (nothing moves after placement).
- Timing: rt_ms = time since last correct tap (inter-node latency); a separate elapsed_since_first_tap_ms field is saved per row so total completion time is always derivable from raw data regardless of whether the very first tap was correct or wrong (summing only correct-tap rt_ms breaks if tap 1 is wrong).

Lock-On (Multiple Object Tracking) — done (logic; skin pending) — showpiece
- Measures: divided attention. Skin: orbs blend after marking, drift, user re-identifies.
- Critical fix applied — object count scales with K. Original fixed-N=8 design had a complement-set flaw: effective tracking load = min(K, N-K), so at K=6 with N=8 there are only 2 distractors and the task becomes trivially easy by tracking the smaller distractor set instead. Fixed: N = 2K (distractor count always equals K), so effective load = K at every level. K escalates 3-6 (N = 6/8/10/12 objects respectively).
- Marking time scales too: MARK_MS = 1500 + 250*K (not flat) — flat marking time would confound tracking capacity with encoding-time pressure at higher K.
- K cap = 6, justified by capacity-ceiling literature (Pylyshyn & Storm), phone touch-target margins at N=12, and confirmed physics headroom (no changes needed to collision/spawn logic at this density).
- Motion: per-object continuous random-walk heading (not fixed trajectory) + edge-bounce + pairwise soft repulsion — guarantees non-looping, non-extrapolable paths. Canvas 2D rendering (not DOM) for frame consistency — dropped frames here would corrupt the "unpredictable motion" property itself.
- Discard-retry bound: 3 consecutive discarded rounds at the same K ends the session (reports interruption, not a miss) — prevents an unbounded retry loop if a tab keeps losing focus. Worst case: 12 rounds (4 K-levels x 3 attempts).
- Escalation: pass → K+1; first miss → end (span = highest K passed); cap at K=6 → end if passed ("reached ceiling").

## 5. Features (beyond the games)

- Entry + segment question (v1 defaults to Performance Seeker).
- Universal measurement engine — built once (Phase 1), reused for all 5 games. performance.now() on requestAnimationFrame, Page Visibility discard watcher, shared saveTrial/ensureSession.
- Practice round before each scored game — built (Phase 3.1). Reuses each game's existing scored-mode trial loop via a mode flag, not a parallel implementation; saved with is_practice: true, excluded from scoring.
- Sequence wrapper — the "[BRAND] Cognitive Performance Lab" flow at /test: intro → practice+scored ×5 games → complete, progress bar across all 10 steps — built (Phase 3.1). See §9b for the run_id/session policy it resolved.
- Scoring engine — built, tested, verified. See §9a below for full detail.
- Results screen — headline score, domain radar, one genuine strength + one growth area, honest product tie-in, email capture, shareable result card — not yet built (Phase 3.3).
- Placeholder product CTA — links nowhere yet; a later team wires it to the agency site.
- Privacy + disclaimer — consent line, visible "not a medical test." Not yet built.
- Analytics events (Phase 5): start, per-game complete, finish, email, CTA click.

## 6. Animations & Juice

Framer Motion. Restrained in the shell, lively in the lab. Micro-feedback on every correct response; smooth stage transitions; between-stage performance meter. Phase 4 — never let polish precede correct measurement. A great-looking mistimed game is worse than an ugly correctly-timed one.

Established pattern from Phase 1-2: skin passes are not risk-free. On both Trigger and Gatekeeper, a "presentation-only" change required real logic changes (a display-state onResult callback hook mirroring the trial loop) and, on Trigger specifically, surfaced two genuine bugs (a gauge/text sync lag, an SVG rotation-origin bug requiring a rewrite from CSS transform to native rotate()). Always re-verify against real Supabase data after any skin pass — never treat "visual only" as "risk-free."

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

None of the shell pages are built yet — all deferred to Phase 4.

## 8. Design System

- Principle: calm shell, lively lab — resolves "interactive but not too much."
- Color: off-white bg, near-black text, one accent (clinical blue or vital green). Dark "lab" mode for games.
- Type: one clean sans (Inter default; Geist/Satoshi for character). Max two typefaces.
- Spacing: generous, consistent scale.
- Components: shadcn/ui base, restyled.
- Design tokens set up day one in Tailwind config.
- Mobile-first, always.
- Placeholders to fill: brand name, exact palette, font, domain.

## 9. Data Model (Supabase)

Raw data always kept.
- sessions — id, created_at, segment, user_agent, consent.
- trials — id, session_id, game, trial_index, stimulus, response, rt_ms, correct, discarded, created_at. (The scientific record — never skip.)
- results — id, session_id, sub_scores (jsonb), headline_score, band_label, computed_at.
- leads — id, session_id, email, created_at, cta_clicked.

Enable Row Level Security — a session should only write and read its own trials (anonymous auth: auth.uid() = the session's own id). This has been empirically confirmed multiple times during development — cross-session reads correctly return empty, including via direct SQL through the anon key. Only a service-role key (dashboard-only, never client-side) can bypass this, which is intentional and should stay that way; it means no client bug or compromised anon key can ever leak or corrupt another session's data.

### 9a. Scoring Engine — built and verified (Phase 3.2 complete)

Located in src/lib/scoring/. Pure functions (trial rows in → scores out, no I/O in the scorers themselves; a separate Supabase fetch/save layer).

Normalization: criterion-anchored piecewise-linear mapping, not population-based (no norm data exists yet). Anchors are grounded in task structure and published task-difficulty reasoning, not fabricated. All anchors, thresholds, and weights live in src/lib/scoring/anchors.ts as documented constants — reviewable line-by-line by the doctor's team.

Per-domain metric and anchor logic:
- Speed (Trigger): median RT over valid (correct, non-discarded) trials. Anchors: ~200ms→100, ~300ms→75, ~450ms→40, ≥650ms→0.
- Impulse Control (Gatekeeper): weighted — 60% no-go accuracy (1 - commission rate), 20% go hit rate (punishes pure withholding), 20% go median RT within the response window. Known granularity limit: only 8 no-go trials means commission accuracy moves in 12.5% steps — a structural limit of the fixed skeleton, not a scoring bug.
- Working Memory (Echo): Pr = hit rate - false-alarm rate (two-high-threshold discrimination index), clamped ≥0, x100. Chosen over d' because Pr maps cleanly to 0-100 without edge-case corrections for perfect/zero rates.
- Flexibility (Circuit): completion time (first tap → final correct tap via elapsed_since_first_tap_ms) with a small error deduction (-3/error, capped -15; kept small because errors already inflate completion time — a large penalty would double-count). Anchors: ~12s→100, ~25s→70, ~45s→35, ≥75s→0.
- Divided Attention (Lock-On): 25 points per K-level fully passed (K=3→25 ... K=6→100) plus partial credit from accuracy at the failed level.

Weighting: equal 20% per domain for v1. Explicitly flagged in code comments as a placeholder simplifying decision, not a validated conclusion — any differential weighting would be an implicit claim about which domain matters more for "brain performance," and there's no validity data to support such a claim yet. Reliability-weighting (Trigger's 25-trial median is statistically more reliable than Gatekeeper's 8-no-go commission rate) was considered and rejected for v1 as harder to explain honestly on a results screen — a UX tradeoff, not a psychometric one. Revisit once real validation data exists.

Minimum-valid-data thresholds per domain (below which a domain returns insufficient_data with a human-readable reason, rather than a fabricated score): e.g. ≥10 valid Trigger trials, ≥6 valid no-go trials, ≥18 valid Echo items, Circuit run not discarded, ≥1 valid Lock-On round. Headline score requires ≥3 of 5 domains scored — below that threshold, no headline is produced at all, only the individual domain results with insufficient-data reasons shown. This has been empirically verified (a real broken-session test correctly renormalized over 3 scored domains and produced the right headline; a version with only 2 domains would have correctly refused a headline entirely).

Insufficient-data reasons are path-specific, not generic: "never played" (zero rows) reads differently from "interrupted" (tab lost focus mid-run, some/all trials discarded). Both cases were verified against real data.

Testing: 34 Vitest unit tests against synthetic fixtures (perfect performer, chance-level responder, never-responder, heavy-discard session, insufficient-data paths) — assert hand-computed values, monotonicity (better raw performance never yields a lower score), and correct floor behavior for degenerate strategies (e.g., mashing every response, or touching nothing). One real bug this caught: 0.2 fractional weights hit exact floating-point rounding ambiguity at a boundary; fixed by using integer percents instead.

Verified twice against real Supabase data: once with a clean 5-domain session (all games completed, headline "Peak session"), once with a broken 3-domain session (2 domains genuinely unplayed/discarded, correct renormalization, "Strong").

### 9b. Repeat-play / run identity — resolved in Phase 3.1

Resolved: a client-minted run_id (uuid, via crypto.randomUUID()) is stamped on every trial and results row of one full-sequence attempt, generated fresh each time the sequence wrapper's intro screen starts a run. session_id stays the visitor's stable anonymous identity; run_id distinguishes attempts, so a retake in the same browser can never mix trials with an earlier attempt. The scoring fetch layer (fetchRunTrials) filters by exact session_id + run_id. Standalone/direct game routes (e.g. /circuit) always pass run_id: null and are never scored. Redo policy: whole-sequence restart only — no per-game mid-sequence redo, to avoid retake-until-lucky cherry-picking of the headline score.

Migration: trials gained run_id (uuid, nullable) and is_practice (boolean, default false); results gained run_id.

Verified against live Supabase data across two real runs (one abandoned via a mid-sequence reload, one completed): the two run_ids never overlapped or cross-contaminated; the abandoned run's trials sit orphaned under their own run_id with no results row and are structurally excluded from the completed run's scoring by the exact-run_id filter; the is_practice exclusion was shown to matter in practice, not just in theory — up to a 13-point swing in one domain, and in Circuit's case a structural scoring corruption (a nonsensical "22 of 16 nodes reached" result) if practice rows were left unfiltered, since Circuit's trial_index is a tap index that restarts at 0 for both the practice and scored segments.

Separately, and more important for the future: when population norms are eventually built (post-v1), do not naively average all sessions' raw metrics. A session that only completed 2 of 5 games (e.g., abandoned after finding Trigger hard) should not silently bias norms for domains it never reached — this would introduce survivorship bias (norms for later domains would only reflect users who didn't quit early, which correlates with unknown factors). Norm-building must filter per-domain, not per-session — a partial session should contribute its valid domains to those domains' norm pools, and nothing to the domains it never reached. This is already structurally possible (each domain scorer independently reports whether it has sufficient data) but the norm-aggregation logic itself doesn't exist yet and shouldn't be built until real user volume justifies it.

Test-data hygiene: the trials table has been truncated multiple times during development to remove verification artifacts (both Claude Code's automated test rows and manual playthrough rows) before further work that reads from the table (e.g., scoring-engine calibration). Always truncate before any work that treats table contents as meaningful data — verification sessions and real user sessions must never be mixed, since nothing in the schema currently distinguishes them.

## 10. Build Order

| Phase | Goal | Status |
|---|---|---|
| 0 — Foundations | Live empty site | Done — Next.js+Tailwind+shadcn deployed to Vercel; design tokens set; Supabase (schema, RLS, anonymous auth) created; env vars set in both .env.local and Vercel |
| 1 — Engine + Trigger | One game measuring + saving correctly | Done — engine verified, Trigger built/skinned/reviewed/committed/pushed |
| 2 — Rest of battery | All 5 games | Done — Gatekeeper, Echo, Circuit, Lock-On all built and logic-verified. Skins pending for Echo, Circuit, Lock-On (Gatekeeper and Trigger skins done) |
| 3 — Flow + scoring + results | Complete funnel | In progress. 3.1 (sequence wrapper) and 3.2 (scoring engine) done. 3.3 (results screen) not yet started — next up |
| 4 — Polish + PWA | Feels pro, works on phones | Not started — shell pages, responsive pass, animations, PWA manifest all pending |
| 5 — Integration + handoff | Live + connected | Not started |

## 11. Testing & Verification Protocol

- Does it run? No console errors, feature works end-to-end.
- Check the DATA, not just the screen — open Supabase: believable RTs (~200-500ms)? No impossible values? Discarded trials flagged correctly?
- Did anything else break? Click through other games/pages.
- Real phone check (Lock-On from Phase 2; all games by Phase 4).
- Run pr-review-toolkit on any commit touching measurement/scoring logic, and at each phase-end QA pass.
- Use the Playwright-based testing skill (from example-skills) for end-to-end checks, Phase 3 onward.
- Only then git commit with a real message.

Additional lessons from Phase 1-3.2, now standing practice:
- A code-level review pass (pr-review-toolkit) finding "clean" is not the end of verification — real bugs have been caught after a clean review by re-checking against actual gameplay data (e.g., Gatekeeper's listener-attach ordering, Circuit's completion-time derivability, Lock-On's complement-set flaw were all found through manual play + data inspection, not static review alone). Treat review-pass and real-data verification as complementary, not substitutes for each other.
- RLS blocks cross-session reads by design — verifying a specific session's data sometimes requires reading it from the same browser/session that created it (a temporary /dev/... debug page, deleted after use, is the established pattern), not from a CLI script or a different browser profile. Don't reach for a service-role key to work around this; it's solving a five-minute inconvenience with a permanent security downgrade.
- When testing edge cases (discard-on-tab-switch, misses, false starts), verify the actual outcome against real Supabase rows, not the on-screen summary alone — the on-screen summary and the saved rows have, more than once, diverged in ways only caught by checking both.

## 12. Skills & Plugins in Use

Project skills (.claude/skills/ — now correctly committed to the repo at project scope, confirmed via Finder inspection; the earlier "currently at personal scope" note was resolved):
- cognitive-task-builder — game logic, timing, trial data.
- brand-design-system — UI, styling, animation.
- data-verification — pre-commit checks, testing setup.

Installed plugins (user scope):
- pr-review-toolkit — review gate before measurement-logic commits and phase-end QA. Don't overuse on trivial changes — 12 agents, real token cost.
- example-skills (anthropic-agent-skills marketplace) — includes the Playwright web-app testing skill.

## 13. Token-Efficiency Working Protocol

- Persistent context = CLAUDE.md only. Feed this reference on demand, per phase.
- One task per prompt.
- Reference files by path; don't paste whole files unless needed.
- Commit + fresh session between features/phases.
- Reuse the engine for games 2-5 — don't regenerate.
- Paste error messages directly for fast fixes.
- Ask for a plan before code, and the simplest version.
- Reserve pr-review-toolkit for measurement-logic commits and phase-end QA, not every trivial change.

Model-tier guidance established during Phase 1-3.2: reserve the highest-capability model (Fable 5, while available; Opus otherwise) for tasks with genuine open-ended reasoning tradeoffs — e.g., Lock-On's physics/complement-set redesign, the scoring engine's normalization-and-weighting design. Routine logic-building (Gatekeeper, Echo, Circuit cores), all skin passes, and integration/UI work (sequence wrapper, results screen, shell pages) are comfortably within a mid-tier model's capability and shouldn't consume premium-tier budget.

## 14. What "v1" Realistically Means

In v1: Performance Seeker flow, all five games, honest self-relative scoring, results + email capture + share, responsive + PWA, deployed.

Deferred (correctly): percentiles (need accumulated norms, and a norm-aggregation approach that filters per-domain, not per-session — see §9b), brain-fog & healthy-aging segments, blog/SEO, deep scientific validation and final claim/legal review (doctor/dev team's job), product-site CTA wiring.

Ship the beachhead. Don't try to build the whole vision in one pass.
