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

Echo (N-back) — done (logic + skin)
- Measures: working memory. Skin: signal-decoding stream, 2-back match — the letter renders in a glowing decoder orb (same radial-gradient motif as Trigger's target), with a "DECODED n" HUD counter.
- Fixed skeleton: 8-letter pool, steady fixed 2500ms SOA regardless of response timing (fire-and-forget capture — an early response must never shorten the interval), letter visible 500ms then blank. 24 items, exactly 7 forced/excluded targets (not probabilistic) so the true target rate is exact, not "roughly." Items 1-2 can never be targets (no 2-back reference yet). Classification: hit / miss / false_alarm / correct_rejection, recomputed from ground truth at runtime, not trusted from the generator.
- Previous-item feedback separation — resolved in the Phase 4 skin pass (was a known UX-only issue: feedback text displayed concurrently with the current letter but wasn't visually distinguished). Fixed with a dedicated `PrevFeedback` chip (`src/components/echo/prev-feedback.tsx`): a small, dimmed, explicitly-labelled "Prev · Signal N" pill below the decoder, so it can never be mistaken for the current item. Purely presentational — receives an already-classified item via the same onResult display-hook pattern used in Trigger/Gatekeeper; no change to the SOA, capture, or classification logic. See §9d.

Circuit (Trail-Making B) — done (logic + skin)
- Measures: task-switching. Skin: glowing trail connecting nodes 1-A-2-B-3-C, timed — implemented in `src/components/circuit/circuit-board.tsx` (grid backdrop, an SVG polyline glow trail linking completed nodes in order, a destructive ring pulse on a wrong tap). Nodes still fire the game's own onPointerDown handler directly; the *next* expected node is deliberately never highlighted, since finding it is the task being measured. See §9d.
- Fixed skeleton: 16-node fixed alternating sequence (1-A-2-B-...-8-H); wrong taps never advance state (no skip-ahead, verified against deliberate ahead-of-sequence taps, not just any-wrong-node taps); already-tapped nodes stay tappable (disabling them would silently narrow what "error" measures). DOM buttons, not canvas (nothing moves after placement).
- Timing: rt_ms = time since last correct tap (inter-node latency); a separate elapsed_since_first_tap_ms field is saved per row so total completion time is always derivable from raw data regardless of whether the very first tap was correct or wrong (summing only correct-tap rt_ms breaks if tap 1 is wrong).

Lock-On (Multiple Object Tracking) — done (logic + skin) — showpiece
- Measures: divided attention. Skin: orbs blend after marking, drift, user re-identifies — the orb (gradient + halo) is baked once into an offscreen sprite and blitted per object per frame, and per-frame trails are one translucent fillRect, both chosen specifically to avoid per-object gradient/shadowBlur cost at N=12 on phone frame rates. Target status only ever reaches the canvas during marking (reticle) and reveal (locked = primary ring, escaped target = solid destructive ring, false lock = dashed destructive ring) — during motion and selection every object is drawn by identical code, so the trail/sprite carry zero tracking information. See §9d for the sustained-play timing verification.
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
- Results screen — headline score, domain radar, one genuine strength + one growth area, honest product tie-in, email capture, shareable result card — built, verified, committed (Phase 3.3). See §9c for detail.
- Placeholder product CTA — links nowhere yet; a later team wires it to the agency site.
- Privacy + disclaimer — built (Phase 4.2, second batch). /privacy carries real (not placeholder) disclaimer + data-collection copy; legal specifics are drafted-but-tagged — see §8a's two-tag convention.
- Analytics events (Phase 5): start, per-game complete, finish, email, CTA click.

## 6. Animations & Juice

Framer Motion. Restrained in the shell, lively in the lab. Micro-feedback on every correct response; smooth stage transitions; between-stage performance meter. Phase 4 — never let polish precede correct measurement. A great-looking mistimed game is worse than an ugly correctly-timed one.

Established pattern from Phase 1-2: skin passes are not risk-free. On both Trigger and Gatekeeper, a "presentation-only" change required real logic changes (a display-state onResult callback hook mirroring the trial loop) and, on Trigger specifically, surfaced two genuine bugs (a gauge/text sync lag, an SVG rotation-origin bug requiring a rewrite from CSS transform to native rotate()). Always re-verify against real Supabase data after any skin pass — never treat "visual only" as "risk-free."

Phase 4 extended this same onResult display-hook pattern to Echo, Circuit, and Lock-On (no new mechanism) and unified the visual grammar across all five games: the dark `.lab` root with a `COGNITIVE PERFORMANCE LAB` HUD strip (live per-game metric + motion toggle), one rounded-3xl card per game with a mono uppercase title/instrument-label subtitle pairing (Trigger's "Reflex Console", Gatekeeper's "Authorization Gate", Echo's "Signal Decoder", Circuit's "Node Board", Lock-On's "Target Tracking"), the same StatBox grid + collapsible per-trial log on every done screen, and the same radial-gradient orb motif reused across stimuli. Reduced-motion is respected throughout. See §9d for the full skin-pass writeup and verification.

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

Home, The Science, About, Product, and Privacy & Disclaimer are built (Phase 4.2 — see §8a). Only Content / Blog remains deferred (later SEO phase).

## 8. Design System

- Principle: calm shell, lively lab — resolves "interactive but not too much."
- Color: off-white bg, near-black text, one accent (clinical blue or vital green). Dark "lab" mode for games.
- Type: one clean sans (Inter default; Geist/Satoshi for character). Max two typefaces.
- Spacing: generous, consistent scale.
- Components: shadcn/ui base, restyled.
- Design tokens set up day one in Tailwind config.
- Mobile-first, always.
- Placeholders to fill: brand name, exact palette, font, domain.

### 8a. Shell Palette, Landing Hero & Placeholder-Copy Rules (Phase 4.2 decisions — locked before shell-page build)

**Site-wide palette split.** Blue is the shared through-line across the whole site — one accent, two expressions:
- Shells (Home, Science, About, Product, Privacy, Blog): calm, light — off-white/white base, blue accent, generous spacing. The existing "calm shell" (§2, §8).
- Lab (the five games + sequence wrapper + results): the existing dark techy-blue lab HUD — unchanged, already built (§6, §9d).
- The shell↔lab transition (entering/leaving /test) is a designed moment, not an abrupt swap — treat the Home→/test entry and the results→shell exit as their own small animation problem when building them, not an afterthought bolted on at the end.

**Landing-page hero.** A 3D animation featuring a PLACEHOLDER product bottle for the nutraceutical brand. Three hard constraints, all non-negotiable:
(a) Placeholder asset only, structured so the real product model (coming later from the agency-built product site) is a clean swap-in, not a rebuild — isolate the model reference/loader so replacing one file/URL is the entire migration.
(b) Must ship with a static poster fallback and respect prefers-reduced-motion — same reduced-motion discipline already used throughout the lab (§6).
(c) Mobile performance is a hard budget, not a nice-to-have — the primary audience is mobile (exam students, professionals — §1). A heavy WebGL hero that tanks mobile Lighthouse/load is a failure condition, not a polish item to fix later.

**Shell-page copy.** All copy on shell pages is STRUCTURAL PLACEHOLDER ONLY — layout- and length-representative filler, every instance clearly marked `[PLACEHOLDER]`. Explicitly forbidden: fabricated testimonials, invented study citations, credentials, or any medical/efficacy claims. Rationale: the scientific-validation team (doctors on the brand side) must be able to find every placeholder by searching for the tag, not have to detect realistic-looking fakes buried in copy that reads as real. The project's honesty stance — "honest, not rigged" (§1) and "never claim medical precision" (CLAUDE.md's NON-NEGOTIABLE SCIENCE RULES) — applies to marketing copy exactly as it applies to scores. This is a stated liability guard given the neurosurgery credibility the whole brand rests on (§1).

**Phase 4.2 build — closed out.** All three decisions above are now built and verified, not just decided:
- **Hero:** no WebGL. A layered SVG/CSS placeholder bottle (`src/components/shell/hero/hero-visual.tsx`), floated and swayed by Framer Motion inside the `--hero-glow` radial — chosen specifically because a real WebGL hero would spend the mobile-performance budget (constraint c) rotating an asset we don't even have yet. The clean-swap contract (constraint a) is documented in that file's header: the real product model replaces `<PlaceholderBottle/>`'s internals, or a lazy `<HeroVisual3D>` drops in behind the same `{ className }` prop — either way it's a one-file migration. Constraint (b)'s reduced-motion requirement is satisfied by the SVG's own static pose (no float, no sway) under `prefers-reduced-motion`; because the asset is SVG/CSS rather than video/WebGL, there is no separate poster-image asset to ship — the static-pose render *is* the fallback.
- **Shell↔lab transition:** both directions now built and verified — the Home→/test entry direction shipped this batch; the results→/shell exit direction shipped in a later pass. See §8b for the exit build and the shared primitive both directions now use.
- **Placeholder-copy rule:** held throughout, with one deliberate exception process used once — the Science page's "How scoring works" section (§9a's criterion-anchored/no-percentiles logic put into plain language) was drafted, shown to the project owner as exact proposed copy, and landed verbatim only after explicit approval, rather than being marked `[PLACEHOLDER]`. It still carries a `[PLACEHOLDER] Wording pending scientific-team sign-off` tag beneath it, so the doctors' team's tag-search still flags it for final review — the interim approval is from the project owner, not the scientific-validation team the rule is ultimately written for.

**Phase 4.2 second batch — Product & Privacy pages (built, verified).** The two remaining core shell pages, same shell primitives (`Section`/`SectionHeading`/`SiteHeader`/`SiteFooter`), no new components or tokens; footer gained the two links (header nav deliberately unchanged, matching About's precedent).
- **Product (`/product`):** pure structural placeholder per the rule above — hero + product-imagery slot, three benefit slots, formulation/ingredient slot, closing CTA band. No product name, ingredients, efficacy claims, pricing, or testimonials anywhere. The CTA is a disabled shadcn `<Button>` (deliberately NOT `EnterLabButton` — wrong destination — and not a live link, since none exists) with a visible "CTA unwired — links to agency site later" caption; a later team wires it to the agency-built product site (§5).
- **Privacy & Disclaimer (`/privacy`):** deliberately NOT decorative filler — most of this page is real copy the app needs now. Three sections: (1) a plain-language "performance exercise, not a diagnosis" disclaimer (real, final-intent, untagged) consistent with CLAUDE.md's never-claim-medical-precision rule; (2) "Exactly what we collect, and why" (real, untagged), written strictly from what the app actually stores per §9 — anonymous session (no account/name/password, RLS-scoped), per-trial stimulus/response/rt_ms/correct/discarded rows, computed results, optional email via the results screen (`leads`), and the session's user-agent string — no generic privacy-boilerplate about data the app doesn't collect; (3) legal scaffolding — controller entity, processors (Supabase + Vercel factual today, PostHog planned), retention, user rights/contact, governing law — drafted as reasoned structure with no invented specifics (the governing-law item deliberately drafts nothing and says why).
- **Two-tag convention (established this batch):** `[PLACEHOLDER]` = marketing/copy-team queue (unchanged from the other shells); `[PLACEHOLDER - LEGAL REVIEW]` = legal-team queue, used on every item in /privacy's section 3. Deliberately distinct strings so each team's tag-search finds only its own queue. Values under the legal tag are reasoned drafts, not commitments.
- Verified: `npm run typecheck` clean; Playwright click-through of both pages + footer nav (titles/h1s render, both Product CTAs disabled, 5 legal-review tags and zero plain marketing tags in /privacy's main content); full-page screenshots reviewed against the shell design system. One console 409 investigated during verification and ruled pre-existing/by-design: `ensureSession()`'s repeat-visitor `sessions` insert hits the unique constraint (23505/HTTP 409) and is explicitly tolerated in `src/lib/supabase/session.ts` — the browser logs the raw network 409 regardless; cosmetic, occurs on every shell page.

### 8b. Shell↔Lab Transition — Exit Direction (results→shell) — built and verified

Closes the gap §8a left open: the results screen had no shell-bound exit at all (its "Learn more about [BRAND]" CTA is `href="#"`, deliberately unwired per §5/§8a; "Start a new run" is lab→lab). Design was walked through and signed off before any code — trigger (one new persistent exit link, not a per-CTA bespoke treatment; retake explicitly excluded — wrong grammar for a lab→lab action), on-screen state (results content holds static, no fade/scale, under an overlay-only sweep — cheapest for a post-session low-battery device per §8a constraint (c)), and technique (reuse the entry sweep's `clip-path` mechanism inverted, not a new one — the "content on screen during transition" problem is structurally identical in both directions).

**Build.** The entry sweep's logic was extracted into a shared primitive, `src/components/shell/zone-sweep.tsx` (`ZoneSweep` component + `resolveSweepOrigin` helper), so both directions stay byte-identical in mechanism and only differ in theme:
- `enter-lab-button.tsx` refactored to a thin wrapper over `ZoneSweep` with `theme="lab"` — behavior-preserving only, re-verified against the original (see Verification below).
- `exit-lab-link.tsx` (new) — same shape, `theme="shell"` (the overlay omits the `.lab` class, rendering in the default/shell background token instead of the lab-dark one).
- `results-screen.tsx` gained exactly one addition: a ghost-style `ExitLabLink href="/"` ("Back to [BRAND] site") placed between the share button and the closing disclaimer. No other results-screen state, load logic, or `onRestart` behavior touched.

**Verification.**
- `npm run typecheck` clean.
- Entry direction re-verified headless (Playwright) after the refactor, both motion states: normal motion showed the overlay with the `.lab` class present mid-sweep before landing on `/test`; reduced motion showed zero overlay and instant native navigation. No regression from the refactor.
- Exit direction verified live against a real completed run, not a mocked or scripted one — a human played all 5 games to a real scored results screen (85, "Peak session") in a separate Chrome profile launched with `--remote-debugging-port`, and Playwright attached via `connect_over_cdp` to inspect that exact tab: the overlay was present mid-sweep with no `.lab` class (confirming shell theme, not lab theme), the URL was still `/test` at that point (confirming the sweep, not native nav, is driving the transition), and it landed cleanly on `/` with the overlay unmounted afterward. Screenshots taken before, mid-sweep, and after.
- Exit reduced-motion was **not independently live-verified** — accepted on the strength of `ExitLabLink` sharing the exact `if (reducedMotion) return` guard and `useReducedMotion` hook as `EnterLabButton`'s already-passing reduced-motion check, with no new branch introduced. Flagged here as a known, deliberate gap rather than silently assumed; close it with a live reduced-motion run if higher confidence is ever needed.
- No pressure at any point to touch scoring/results-data/email logic — the whole change stayed presentation-only, matching every prior skin pass's boundary (§9d, §6).

**Verification-technique notes worth keeping** (see §11 for the general lessons; specific to this pass):
- Reaching a real results screen without hand-automating all 5 games' input mechanics (Lock-On's canvas tracking especially) was solved by having a human play live in a real browser tab and attaching Playwright to that tab via Chrome's remote-debugging protocol (`connect_over_cdp`), rather than building throw-away automation for game logic the change never touches.
- `EnterLabButton`/`ExitLabLink` render as `<a role="button">` (Base UI's `nativeButton={false}` composition), not `role="link"` — a Playwright `get_by_role("link", ...)` query on "Take the Brain Test" silently matches the footer's unrelated plain `<a href="/test">` nav link (same visible text, real `role="link"`) instead. Must query `role="button"` for these components specifically.

Raw data always kept.
- sessions — id, created_at, segment, user_agent, consent.
- trials — id, session_id, game, trial_index, stimulus, response, rt_ms, correct, discarded, created_at. (The scientific record — never skip.)
- results — id, session_id, sub_scores (jsonb), headline_score, band_label, computed_at.
- leads — id, session_id, email, created_at, cta_clicked. `session_id` has a
  unique constraint (Phase 3.3b) — one lead per session, not per run (leads
  has no run_id column; a retake that already submitted an email is
  recognized as already-submitted, not re-inserted). Deliberately NOT unique
  on email: two different anonymous sessions submitting the same email must
  not collide, since a uniqueness violation there would leak "this email
  already exists" across sessions, breaking the per-session RLS isolation
  below.

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

### 9c. Results Screen — built and verified (Phase 3.3 complete)

Located in src/components/results/. Built in two reviewed, live-verified parts.

**Part (a) — score display, radar, insights.** `results-screen.tsx` fetches a
completed run's trials, calls the (untouched) scoring engine, and persists
the result via `saveResult`'s idempotent upsert on `results.run_id` (unique
constraint added this phase — a plain insert would double-write on a
StrictMode remount or any future re-render of the results screen).
`domain-radar.tsx` renders the five-domain Recharts radar; the core design
problem was that a missing measurement must never read as a zero (0 is a
real score elsewhere on the same chart) or as a broken chart (a missing
axis). Solved with: the five-axis frame always renders in full regardless of
data; the score polygon only has vertices on scored domains; edges that
bridge across an unscored axis are dashed; the unscored spoke itself is
dashed/greyed with an explicit "no clean data" label tag, never silently
absent. `insights.ts` picks one strength + one growth domain — eligibility
is `status === "scored"` only (an unmeasured domain is never a strength or a
weakness), ties break on canonical domain order, and an all-equal-score run
reports "balanced" rather than fabricating a growth area. All three states
(full run, partial/insufficient-domains, no-headline) were verified via a
temporary fixture route (deleted before each commit) and cross-checked
against real Supabase runs, including hand-tracing two real interrupted runs
(a tab-switch mid-Echo, a tab-switch mid-Lock-On) to confirm the Page
Visibility discard watcher excluded exactly the invisible-window trials and
nothing leaked either direction.

Shared radar geometry was then extracted into `radar-geometry.ts`
(`radarPolygon` — pure vertex/edge-selection index math) and
`domain-radar.tsx` exports `polarPoint` — a deliberately minimal,
behavior-preserving refactor (re-verified pixel-identical against all three
radar states afterward) done specifically so the share-card SVG builder in
part (b) could reuse the same geometry instead of re-deriving it.

**Part (b) — email capture + share card.** `src/lib/supabase/leads.ts`
mirrors the existing `ensureSession()` insert+23505 convention (plain
insert, not upsert, so "duplicate" is a distinguishable UI state, not a
silent no-op) — see the `leads.session_id` unique-constraint note in §9.
Live-verified at three levels: the UI showed the correct duplicate message
on a resubmit from the same session, the message is only reachable via a
real `error.code === "23505"`, and a direct data-layer read confirmed
exactly one row exists (the second attempt was blocked, not duplicated).

The share card (`share-card.ts` + `share-button.tsx`) builds a fixed
1080×1080 SVG string (hardcoded lab-theme colors, not CSS variables — it's
rasterized off-DOM via canvas with no page style context), serializes it to
a PNG Blob, and shares it via `navigator.share()`/`canShare()` — the
`canShare({files})` check matters specifically because `navigator.share`
alone doesn't guarantee file-sharing support. The PNG is pre-rendered in a
`useEffect` on mount, not inside the click handler — calling `share()` after
an async SVG→canvas→blob pipeline risks losing "user activation" on Safari,
so by click time the Blob already exists and `share()` fires synchronously
within the click's call stack. No file-sharing support (or the share call
throwing anything other than a user-cancelled `AbortError`) falls back to a
plain download.

Two real bugs were caught during live verification, both illustrating why
"clean code review + doesn't crash" isn't sufficient — see §11's standing
lesson on this:
1. The email form's `type="email"` input let the browser's native
   validation UI intercept invalid submissions before the app's own themed
   error message could ever render — invisible in a code read, only visible
   by actually submitting bad input in a browser. Fixed with `noValidate` on
   the form (native format hinting is still useful for the mobile keyboard
   layout, so `type="email"` stayed).
2. The share card's axis-label `<text>` elements were missing their `y`
   attribute entirely (only `x` was set) — SVG defaults omitted
   positional attributes to 0, so all five labels rendered stacked at the
   top of the image instead of around the radar. This produced a
   visually-plausible-looking image at a glance (score, band, and the
   radar shape itself were all still positioned correctly) — the defect
   only became obvious by rendering the actual generated PNG in an
   isolated tab and reading it pixel-by-pixel, not from the SVG string
   looking reasonable at a skim.

### 9d. Phase 4 Game Skins (Echo, Circuit, Lock-On) — built and verified

Skinned all three remaining games in one pass, as a single coherent visual system with Trigger/Gatekeeper (see §6 for the shared grammar). Every change was presentational only, using the established onResult display-hook pattern — none of it touches saveTrial, rt_ms capture, or discard logic.

**Echo** — new `src/components/echo/prev-feedback.tsx`. Resolves the previous-item feedback-overlap issue noted in §4: a small, dimmed, explicitly-labelled "Prev · Signal N" chip renders the prior item's classification below the decoder orb, so it can never be mistaken for the current letter.

**Circuit** — new `src/components/circuit/circuit-board.tsx`. Grid backdrop, an SVG polyline glow trail linking completed nodes in tap order, a destructive ring pulse on a wrong tap. The next expected node is deliberately never highlighted.

**Lock-On** (showpiece) — the orb (gradient + halo) is baked once into an offscreen sprite and blitted per object per frame instead of drawing a fresh gradient per object; per-frame trails are a single translucent `fillRect` over the previous frame. Both choices exist specifically for phone frame-rate headroom at N=12 — the old per-object-gradient approach would not have scaled. Target status reaches the canvas only during marking (reticle) and reveal (locked = primary ring, escaped target = solid destructive ring, false lock = dashed destructive ring); during motion and selection every object is drawn by identical, unconditional code.

**Verification against live Supabase data:**
- Echo: a full 24-item scored run — exactly 7 targets → 7 miss + 17 correct_rejection rows, 0 discarded, save-timestamp spacing averaging 2504ms across 23 intervals (fixed 2500ms SOA held under the new skin).
- Circuit: a full run including one deliberate wrong tap — saved correctly as `correct=false` with its own rt_ms; `elapsed_since_first_tap_ms` strictly monotonic through to completion, matching the on-screen completion time.
- Lock-On: rounds verified with `mark_ms_measured`/`motion_ms_measured` matching nominal on first pass, reveal-ring grammar correct on screen.

**Sustained-play timing-drift check (Lock-On).** A follow-up pass played 7 additional live rounds over ~7.5 minutes specifically to rule out a creeping per-frame cost from the new trail/reticle/selected-ring draw work under repeated play (as opposed to a single verification round). `mark_ms_measured` and `motion_ms_measured` deltas from nominal stayed in a tight 0–8ms band across the whole chronological sequence, with no upward trend correlated with play order — consistent with ordinary requestAnimationFrame boundary quantization (8ms is sub-one-frame at 60fps), not accumulating draw cost. One of the 7 rounds was a genuine tab-visibility discard; its timing (2251.0ms mark / 6000.0ms motion) was indistinguishable from the non-discarded rounds, confirming the visibility watcher flags rounds post-hoc without perturbing the rAF timing loop itself.

Known verification gap: all 7 rounds landed at K=3. Reliable K-escalation requires visually tracking which orbs were tagged through the ~6s motion phase, and the browser-automation tool's round-trip latency exceeds Lock-On's ~2.25s marking window — by the time a screenshot returns, marking has already ended, so there was no way to observe target identity and select correctly better than chance (≈5% per attempt at K=3). `motion_ms` is a fixed 6000ms constant independent of K by design, so this gap is narrower than it sounds — only `mark_ms`'s K-scaling (1500+250·K) remains empirically unverified above K=3 from this specific check; the formula itself is unchanged, deterministic code untouched by the skin pass. Closing this gap requires either a human playtester or a temporary dev-only K-override, and either would need sign-off before implementing (the latter touches game code).

**Unrelated bug found and fixed alongside this phase.** `src/components/results/__tests__/insights.test.ts` had 25 `tsc` errors, present since it was added in Phase 3.3a (commit `31a033f`) and invisible until now. Root cause: `next build`'s TypeScript check only walks files reachable from the app's route import graph (pages/layouts and their imports) — not every file `tsconfig.json`'s `include` glob covers — so a test file that nothing imports can fail a full `tsc --noEmit` while `next build` still reports "Finished TypeScript" clean. Confirmed empirically: stashing the fix and running `next build` on affected HEAD still passed. The test itself was wrong since day one: its `scored()` fixture helper and `insufficient` constant were both typed with `DomainScore`'s default generic (`Record<string, unknown>`), which doesn't structurally satisfy `DomainScores`' per-domain specific detail types (`TriggerDetail`, `GatekeeperDetail`, etc., in `src/lib/scoring/types.ts`). Fixed by replacing the one generic helper with five domain-specific `scoredX()` helpers built from the real detail shapes, and narrowing `insufficient` to an `as const` literal (the `insufficient_data` variant doesn't reference the generic at all, so a narrow literal type-checks against every domain's `DomainScore<T>`). No change to `domains.ts`, the scoring engine, or any assertion — `pickInsights` never reads `.detail`, only `.status`/`.score`. Added a `npm run typecheck` script (`tsc --noEmit`, see §3/README) and a CLAUDE.md HOW TO WORK line so `next build` alone is never again treated as proof of a clean typecheck — see §11's lessons list.

### 9e. Production Session-Integrity Incident & Fix (July 2026)

A user reported completing two full 5-game sessions on the deployed Vercel site via iPhone Safari; every domain came back `insufficient_data`. This started as a bug investigation and grew into a real architectural addition to session handling — recorded here in full rather than as a changelog line, since the fix's central design insight (below) governs how any future session/identity-adjacent change must be reasoned about.

**The bug.** Investigation confirmed zero trials and zero results saved to Supabase for the reported session — not misfiled under an unexpected `session_id`/`run_id` (`fetchRunTrials`'s exact-pair filter was intact, and there were zero orphaned trials in the whole table at the time), genuinely absent. Root cause: the Supabase client's anonymous-auth JWT, persisted in `localStorage`, could desync from the identity `ensureSession()` was handing back to game code — most likely triggered by iOS Safari backgrounding or reloading the tab mid-flow. Every `saveTrial()` call was wrapped in `.catch(() => false)`, so once RLS rejected an insert (`auth.uid() = session_id` no longer held), the failure vanished completely: no crash, no console error, no visible state change. A user could play the entire ten-minute sequence and only discover the loss at the results screen, looking at an honest-seeming "insufficient data" message with no indication anything had gone wrong upstream.

**Investigation trail — Candidate A (broken production env vars), investigated and ruled out.** The first hypothesis was that Vercel's Production environment variables for `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` were missing or wrong. This could not be settled by checking the Vercel dashboard alone: Next.js inlines `NEXT_PUBLIC_*` variables into the client JS bundle at *build time*, not read at runtime — so a dashboard showing a broken/empty value only proves the *next* build would ship broken, it says nothing about what's in the bundle already being served to users right now. Closing this required fetching the actual live production JS chunks and confirming the correct Supabase project URL and a matching anon key (decoded via its JWT `ref`/`role` claims) were genuinely baked into what users' browsers were running. They were — Candidate A was closed by inspecting the live bundle, not by trusting the dashboard.

A real, separate bug *was* found and fixed along the way, though: both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were genuinely empty in the Vercel dashboard's Production scope. This hadn't broken anything live (per the build-time-inlining point above — the currently-deployed bundle predated the values going empty), but it was a live time-bomb: the next production build/deploy would have shipped with a non-functional Supabase client. Editing the values directly in the Vercel dashboard silently failed to persist (re-pulling via `vercel env pull` kept showing empty after saving), for reasons never identified; the fix was removing and re-adding both variables via `vercel env add` through the CLI instead, explicitly declining to mark them Sensitive since `NEXT_PUBLIC_*` variables are already public in the client bundle by design — marking them Sensitive would only hide the value from the dashboard/CLI without adding any actual protection.

**The three-layer fix.**
- **Layer 1 — `src/lib/supabase/client.ts`:** explicit auth configuration (`persistSession`, `autoRefreshToken`, `flowType: "pkce"`, a fixed `storageKey`) instead of relying on supabase-js's implicit defaults.
- **Layer 2 — `src/lib/supabase/session.ts`:** a self-healing `onAuthStateChange` listener, gated on a `runActive` flag set by the sequence wrapper. This is the key design insight of the whole fix: silently re-authenticating to a new identity is only safe *before* a run starts, when no trials exist yet under any `run_id`. Once a run is active, a detected desync must never silently swap identities — doing so would risk splitting one run's trials across two different `session_id`s, a direct violation of §9b's isolation invariant (`fetchRunTrials`'s exact `(session_id, run_id)` filter has no way to recover a run split that way). The naive version of this fix — self-heal unconditionally, any time a desync is detected — would have been *worse* than the original bug: it trades an honest, total data loss (today's failure mode) for a silent, partial, contaminated run that still produces a real-looking headline score. Mid-run, the listener deliberately does nothing, leaving the stale cached identity in place so the next save fails fast and visibly via RLS rejection instead.
- **Layer 3 — `src/app/test/page.tsx`:** an intro-screen session gate (checking/ready/blocked tri-state, with a Retry button, before "Begin" is enabled) and a mid-run halt-and-restart screen (any step reporting a save failure halts the sequence instead of silently continuing toward a bogus results screen). Restart intentionally reuses §9b's existing whole-sequence-restart policy rather than inventing new recovery machinery — the halted run's trials are simply abandoned under their own `run_id`, exactly like any other reload-abandoned run.

**Three bugs the fix itself had, caught by pr-review-toolkit — each worth recording as its own lesson.**
(a) `ensureSession()`'s memoized promise was never cleared on rejection, so once `createSession()` failed once, every subsequent call — including the user clicking "Retry" — returned the same permanently-rejected promise forever. Fixed with an explicit `resetSession()` export, called from the restart path. This bug specifically escaped the first Playwright test pass because that test's simulated failure (a blocked network call to the auth endpoint) never triggers a real `onAuthStateChange` event — the review agent's independent trace of the actual desync mechanism caught it where the test's failure model didn't match the incident's. General lesson: a test's simulated failure mode has to match the real failure's *mechanism*, not just its user-visible symptom, or the test can pass while the underlying bug ships anyway.
(b) `runActive` was never reset back to `false` after a *successful* run reached the results screen — only on the halt-and-restart path. Since it's a module-level flag surviving the whole tab's lifetime, one successful run permanently disabled the pre-run self-heal for any later run attempted in that same tab. Fixed by resetting it in the step-advance handler when the final step crosses into the results screen.
(c) A spurious auth-state-change event fires during the very first page load (before `createSession()` finishes establishing the initial identity), which the listener was reacting to unnecessarily — harmless (idempotent, pre-run) but wasteful. Fixed by ignoring events until an identity has actually been established once.

**Verification.** Four Playwright scenarios: the pre-run gate (blocked → Retry → ready), a mid-run halt via a blocked network call, a mid-run halt-and-restart-recovery test using a *genuine* identity desync (Supabase's real cross-tab session sync via the native browser `storage` event — no production code modified to enable this), and a real unblocked full practice+scored run cross-checked against live Supabase data. A red/green check specifically confirmed the retooled desync-recovery test fails without bug (a)'s `resetSession()` fix and passes with it — proving the test actually exercises the bug rather than trivially passing either way. Two separate pr-review-toolkit passes: an initial full-diff review (which found bugs a/b/c above) and a second, incremental review scoped to just the three fixes, which came back clean, including explicit re-tracing of the `resetSession()`/`runActive`/`onAuthStateChange` interaction for races and the existing results-screen retake path. `npm run typecheck` and `next build` were clean throughout every stage.

**Test-data hygiene.** `sessions`, `trials`, `results`, and `leads` were truncated after this session (standard practice per §9b — verification/test rows and real user data must never be mixed). The first genuinely clean data in these tables going forward is whatever real playthrough happens next.

### 9f. Retry-Then-Halt Fix — a single dropped save no longer costs the whole run (July 2026, follow-up to §9e)

A real user played a full 5-game run on iPhone; the score never came, with an on-screen message about a lost connection. Investigation confirmed §9e's halt-on-any-save-failure design fired correctly and exactly as designed — but the actual cause wasn't identity desync at all: a single trial insert (Lock-On scored round, one trial) genuinely dropped due to a transient network blip, the two trials saved immediately after it under the *same* session_id/run_id succeeded fine, and the whole 10-minute run was discarded over one lost packet. Confirmed via Supabase: all 4 other games' data complete and clean, Lock-On scored missing exactly `trial_index: 0`, zero results row (halt fired before reaching results, per §9e design).

This is §9e's halt policy working as designed, but the policy itself was too strict for the common case: it can't distinguish "one-off network blip, identity fine" (proven by the very next trials succeeding under the same identity) from "desync starting, more failures coming" — so it treated every failure the same way. That distinction is exactly what this fix adds.

**The fix — retry with backoff inside `saveTrial()` only** (`src/lib/engine/save-trials.ts`), zero changes to any game file, `GameProps`, or the sequence wrapper — §9e's halt/restart architecture is untouched, this only changes what counts as a "failure" worth halting over:
- 1 initial attempt + 2 retries, 400ms then 1000ms backoff — but *only* for transient-shaped failures.
- Classification is by HTTP `status`, not `error.code` (see the review-caught mistake below): `status === 0` (pure network failure — no response ever received) or `status === 503` (PostgREST/DB-layer transient unavailability) retry; anything else (401, 403 — including RLS's 42501, 400, etc.) fails fast, zero retries, since a genuinely mismatched identity rejects every attempt identically and retrying it is pure wasted latency before the (still-necessary) halt.
- Duplicate-row guard, two layers: an existence check before each retry (best-effort — a query, not atomic), backed by a real DB guarantee — `supabase/migrations/20260714_trials_unique.sql` adds a partial unique index on `trials(session_id, run_id, game, trial_index, is_practice) WHERE run_id IS NOT NULL` (partial so standalone/direct game plays, which always have `run_id: null` and are never scored, don't collide with each other across independent visits). A retry that slips past the existence check now gets `23505` from the DB instead of creating a duplicate; `saveTrial` catches `23505` on *any* attempt (first or retry) and treats it as success — this also makes the function idempotent against a React StrictMode double-invoke, not just against the network race.

**Two real classification bugs caught by the first pr-review-toolkit pass, both closed by switching from `error.code` to `status`:**
1. A PGRST-coded transient error (e.g. `PGRST000`, "could not connect to the database") *does* carry a non-empty `error.code`, despite being exactly the transient case retry exists for — the original `Boolean(error.code)` check wrongly treated it as a permanent rejection and failed fast. Confirmed by reading the installed `@supabase/postgrest-js` source directly (`node_modules/@supabase/postgrest-js/dist/index.mjs`): a non-ok HTTP response always populates `error` via `JSON.parse(body)`, `code` included, regardless of whether the underlying cause was transient or permanent — `code` presence alone was never a valid signal. `status`, by contrast, is explicitly set to `0` in the library's own fetch-rejection handler for a genuine network-level failure, and PostgREST's transient-unavailability responses are reliably `503` — both empirically confirmed, not assumed.
2. The existence-check guard (`rowAlreadySaved`) used `.eq("run_id", row.run_id)` unconditionally — `.eq()` with a JS `null` does not match SQL `NULL` in PostgREST (confirmed against the library's own docs, which explicitly say to use `.is()` instead), so the guard silently never worked for standalone/direct plays. Fixed with an explicit `run_id === null ? .is(...) : .eq(...)` branch. Low impact (standalone plays are never scored), but a real latent bug.

**Verification, two full passes plus an incremental review, each with live data:**
- Pre-fix baseline reproduced first: a genuine iOS-style single dropped insert, confirmed via real Supabase rows (missing `trial_index`, zero results row) before writing any code.
- Post-fix, live against the dev server + real Supabase throughout: a simulated dropped insert followed by a successful retry (no halt); a genuine cross-tab identity desync (real `storage`-event sync, same technique as §9e) still fails fast (0.18–0.19s, confirming zero wasted retries on a real rejection); a "response lost after commit" race (via Playwright's `route.fetch()` to genuinely commit server-side, then aborting the client's view of the response) caught by the existence check, no duplicate row; after the classification fix specifically, a synthetic PGRST000-coded 503 now correctly retries (previously would have wrongly failed fast) and a synthetic 401 still fails fast; and, after the migration was applied, the 23505 path verified two ways — `saveTrial` treats a `route.fulfill`'d 23505 as success (deterministic, tests the application code), and a *real* duplicate insert (captured request headers/body from a genuine successful save, replayed verbatim via Playwright's own request context against the live, migrated DB) returned an actual `409, code: "23505", constraint "trials_unique_scored_trial"` — the DB guarantee confirmed live, not assumed from the migration's intent. A full unblocked live run was re-verified against Supabase twice (once per fix round), byte-identical to the pre-fix baseline both times (25 scored + 3 practice, 0 discarded). `npm run typecheck` and `next build` clean throughout every round.
- Two pr-review-toolkit passes: the first found the two classification bugs above plus the stale-comment/first-attempt-23505-is-not-dead-code questions (both resolved as correct-as-written); the second, scoped to the incremental fixes, confirmed all of it correct, including tracing the migration's partial-index column order against `rowAlreadySaved`'s query (usable, no full-scan risk) and confirming zero pre-existing duplicate rows in live data (495 rows checked) before the migration was applied — so the `CREATE UNIQUE INDEX` was guaranteed not to fail on existing data.

**Known, accepted, non-blocking gaps, flagged rather than silently left implicit:**
- `502`/`504`/`429` currently fail fast rather than retry — a real gap (Supabase's edge/gateway layer can emit these transiently, independent of PostgREST's own `503`), left as a deliberate, conscious choice rather than expanding `isTransient` speculatively; revisit if these show up in practice.
- The existence-check guard can false-positive across independent standalone (`run_id: null`) replays of the same game by the same session (matching an unrelated earlier visit's row instead of confirming the current one) — impact is nil, since standalone plays are never scored and the partial unique index deliberately excludes them from the duplicate-prevention guarantee too.

## 10. Build Order

| Phase | Goal | Status |
|---|---|---|
| 0 — Foundations | Live empty site | Done — Next.js+Tailwind+shadcn deployed to Vercel; design tokens set; Supabase (schema, RLS, anonymous auth) created; env vars set in both .env.local and Vercel |
| 1 — Engine + Trigger | One game measuring + saving correctly | Done — engine verified, Trigger built/skinned/reviewed/committed/pushed |
| 2 — Rest of battery | All 5 games | Done — Gatekeeper, Echo, Circuit, Lock-On all built and logic-verified. All 5 games' skins now done too (Echo/Circuit/Lock-On skinned in the Phase 4 batch, §9d; Gatekeeper/Trigger skins were done earlier) |
| 3 — Flow + scoring + results | Complete funnel | Done — 3.1 (sequence wrapper), 3.2 (scoring engine), and 3.3 (results screen: score/radar/insights + email capture/share card) all built, verified against live Supabase data, reviewed, committed |
| 4 — Polish + PWA | Feels pro, works on phones | In progress — game-skin batch complete (§9d). **Shell pages: all five core shells done** — Home, Science, About, Product, Privacy & Disclaimer (§8a). **Shell↔lab transition: both directions done** — entry (Home→/test) and exit (results→shell) share one `ZoneSweep` primitive, both verified live (§8b). Remaining Phase 4 scope: Content/Blog page (deferred — later SEO phase); a full responsive polish pass; the PWA manifest; and the still-outstanding real-phone check of all five shell pages (§11) |
| 5 — Integration + handoff | Live + connected | Not started |

**Post-launch production incidents (outside the phase sequence above).** Two, both after the Phase 4.2 shell-page work, both from real user reports, neither phase-scoped in the build-order sense (every affected piece — the measurement engine, the games, the sequence wrapper — was already "Done" per the table above):
1. A session-integrity bug — silent, total trial-save loss on iOS Safari. Fix added a genuinely new architectural layer (self-healing, run-active-gated session identity handling) to already-shipped code. §9e.
2. A follow-up: §9e's own halt-on-any-failure policy, working exactly as designed, cost an entire run over one transient dropped insert. Fix adds bounded retry-with-backoff for transient failures only, before a save is counted as a real halt-worthy failure, plus a DB-level unique index closing a duplicate-row race the retry itself could otherwise introduce. §9f.

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
- Generated visual assets (the share-card PNG, Phase 3.3b) can look correct at a glance — right score, right shape, right colors — while a specific element is silently mispositioned (a missing SVG attribute defaulted to 0). Skimming the generated SVG/markup is not enough; render the actual output artifact and inspect it directly. For canvas/blob output specifically, the working pattern this phase: patch `URL.createObjectURL` to capture the blob, convert to a data URL, and load it in a freshly-opened, otherwise-empty tab (isolates it from any on-page content it could visually blend with).
- Native browser behavior (HTML5 form validation, autofill, etc.) can silently intercept custom UI before your own code ever runs, and this is invisible from reading the code — it only shows up by actually submitting through a real browser. Check any form-adjacent UI this way, not just its handler logic.
- A schema assumption that held for one table (e.g. a unique constraint) does not automatically hold for a sibling table — `leads` had no unique constraint where `results` did, despite both looking superficially similar. Always confirm the actual constraints (`pg_constraint`/`pg_indexes`), don't infer from a table's role.
- `next build` passing is not proof of a clean typecheck (Phase 4). Its TypeScript check only walks files reachable from the app's route import graph, not everything `tsconfig.json`'s `include` covers — a test file nothing imports can carry real `tsc` errors invisibly for phases at a time (§9d: 25 errors in `insights.test.ts`, present since Phase 3.3a, unnoticed until an explicit `npm run typecheck` run). Run `npm run typecheck` (`tsc --noEmit`) as its own step, don't rely on build output alone.
- Automated browser-tool round-trip latency can exceed a short timed UI window. Lock-On's ~2.25s marking phase elapsed before a screenshot request could ever return, making it impractical to visually verify or interact with that phase via this harness (§9d). When a game has a sub-3s critical window, plan verification around what's actually observable after the fact (saved timing fields, final state) rather than trying to react to the window live.
- **Real-phone check still pending for the Phase 4.2 shell pages.** §11's "real phone check ... all games by Phase 4" line covers the games (done, §9d); it has not yet been extended to the shell pages (Home hero animation/perf, the shell→lab sweep, responsive layout on Science/About, and the second-batch Product + Privacy pages). Emulated desktop/mobile viewports were verified (see below), which is not a substitute — do this before the shell pages are considered fully verified, not just before ship.
- **The in-app browser-pane harness pauses `requestAnimationFrame` and page compositing when the pane is backgrounded between tool calls** (`document.visibilityState` goes `hidden`), which froze Framer Motion animations mid-keyframe and, after programmatic scrolls, sometimes returned blank background-only screenshots even though the DOM was healthy (confirmed via computed-style/rect inspection before concluding it was a harness artifact, not an app bug — reloading the page recovered top-of-page screenshots). Working pattern for this and future sessions: drive verification of anything animation-, reduced-motion-, or scroll-dependent through a standalone Python Playwright script instead of the browser-pane tool. `prefers-reduced-motion` specifically requires this — the pane has no way to emulate the media query at all, only Playwright's `browser.new_context(reduced_motion="reduce")` does. Note the environment detail: plain `python`/`python3` resolves to a pyenv version without Playwright installed; `~/.pyenv/versions/3.12.5/bin/python` is the one with it.
- **A config dashboard's current value is not proof of what's actually live** (§9e). Next.js inlines `NEXT_PUBLIC_*` env vars into the client bundle at build time — a Vercel dashboard showing an empty/wrong value only means the *next* build would break, not that production is broken right now. When production behavior is genuinely in question, fetch and inspect the deployed JS bundle directly (or equivalent for the platform), don't stop at the config UI.
- **A `.catch(() => false)` (or any error-swallowing pattern) on a write to an RLS-protected table is a distinct, higher-severity hazard than ordinary error handling** (§9e) — it doesn't just hide a bug, it silently converts a should-be-loud auth/permission failure into data that looks like it saved. Any write path guarded by RLS should be treated as needing visible failure surfacing by default, not opt-in.
- **A test's simulated failure must match the real failure's mechanism, not just its symptom** (§9e). A Playwright test that induced "trials don't save" via a blocked network call passed even though the actual fix for a genuine identity-desync-induced failure was broken — the blocked-network failure mode never exercised the code path the real incident hit. When retooling a test specifically because a review caught something the test missed, prefer reproducing the real mechanism (here: Supabase's genuine cross-tab `storage`-event session sync) over a more convenient stand-in, and confirm with a red/green check that the retooled test actually fails without the fix.
- **The naive version of a fix can be worse than the bug it's fixing** (§9e) — self-healing a desynced session identity unconditionally would have traded an honest total data loss for a silent, contaminated partial run. Before landing a fix for a data-loss bug, explicitly trace what happens if the fix's own recovery path fires at the worst possible moment (mid-write, not just pre- or post-), since "recover automatically" is not always safer than "fail loudly."
- **A strict safety policy can itself become the next bug** (§9f) — §9e's halt-on-any-failure was the *correct* fix for its own incident, but its own severity (one dropped packet costing a full 10-minute run) only became visible from a real user report, not from reasoning about the design in the abstract. When a safety-first fix trades false negatives for false positives, budget for a follow-up pass once it's had real usage, rather than assuming the first version is the final word.
- **`error.code` presence is not a reliable signal for "permanent vs. transient" in supabase-js/PostgREST** (§9f) — a transient, retry-worthy failure (e.g. `PGRST000`, DB unreachable) still carries a structured `code`, just like a permanent RLS rejection does. Classify by HTTP `status` instead (`0` = network-level failure, `503` = DB/PostgREST-layer transient unavailability, confirmed against the installed library's source, not assumed from general REST conventions) when deciding whether to retry.
- **`.eq(column, null)` does not match SQL `NULL` in PostgREST** — silently returns zero rows instead of erroring, so the bug is invisible until you specifically test the null case. Use `.is(column, null)` for nullable-column lookups; confirmed against the library's own documentation, not inferred.
- **Read the installed dependency's actual source when a library's error/response shape matters for a correctness decision** (§9f) — `node_modules/@supabase/postgrest-js/dist/index.mjs` settled two separate classification questions this pass that general knowledge of "how REST client errors usually look" would have gotten wrong. Version-specific behavior beats general recollection every time it's cheap to check.
- **For a presentation-only change, don't build automation for game mechanics the change doesn't touch** (§8b) — verifying the results→shell exit sweep needed a real completed results screen, but hand-automating all 5 games' inputs (Lock-On's canvas tracking especially) was solved instead by having a human play live in a real Chrome tab (launched with `--remote-debugging-port`) and attaching Playwright to that exact tab via `connect_over_cdp`. Reach for this whenever the thing under test is downstream of application state that's expensive to synthesize but easy for a human to produce once.
- **Base UI's `nativeButton={false}` composition renders `role="button"`, not `role="link"`** (§8b) — a Playwright `get_by_role("link", ...)` query against one of these can silently match an unrelated plain `<a>` elsewhere on the page with the same visible text instead (here: the footer's real nav link, same CTA copy as `EnterLabButton`/`ExitLabLink`). Query `role="button"` for any component built on this pattern.
- **CSS `text-transform: uppercase` (or similar) changes what `innerText`/Playwright's `inner_text()` returns** — browsers compute it post-style, so scraped text comes back uppercased even though the source string isn't. Match case-insensitively when scraping text inside an uppercase-styled ancestor (common throughout this app's mono-uppercase HUD labels, §6).

## 12. Skills & Plugins in Use

Project skills (.claude/skills/ — now correctly committed to the repo at project scope, confirmed via Finder inspection; the earlier "currently at personal scope" note was resolved):
- cognitive-task-builder — game logic, timing, trial data.
- brand-design-system — UI, styling, animation.
- data-verification — pre-commit checks, testing setup.

Installed plugins (user scope):
- pr-review-toolkit — review gate before measurement-logic commits and phase-end QA. Don't overuse on trivial changes — 12 agents, real token cost.
- example-skills (anthropic-agent-skills marketplace) — includes the Playwright web-app testing skill.

MCP servers (user scope, Phase 3.3):
- Supabase MCP — read-only, scoped to this project's ref via `--read-only --project-ref=...`. Registered at **user** scope specifically; registering it at project/directory scope first meant it silently didn't load from this repo's working directory (`claude mcp list` showed it registered under the wrong project path) — re-registering with `--scope user` fixed it, and this is now the working setup. Supersedes the old "temporary /dev/... debug page" pattern for reads (§11); still can't write, so migrations still go through the Supabase SQL editor by hand.

## 13. Token-Efficiency Working Protocol

- Persistent context = CLAUDE.md only. Feed this reference on demand, per phase.
- One task per prompt.
- Reference files by path; don't paste whole files unless needed.
- Commit + fresh session between features/phases.
- Reuse the engine for games 2-5 — don't regenerate.
- Paste error messages directly for fast fixes.
- Ask for a plan before code, and the simplest version.
- Reserve pr-review-toolkit for measurement-logic commits and phase-end QA, not every trivial change.
- Run `npm run typecheck` (`tsc --noEmit`) as its own step before treating a change as verified — `next build` alone only checks files reachable from the app's routes and can miss real errors elsewhere (e.g. test files; see §11).

Model-tier guidance established during Phase 1-3.2: reserve the highest-capability model (Fable 5, while available; Opus otherwise) for tasks with genuine open-ended reasoning tradeoffs — e.g., Lock-On's physics/complement-set redesign, the scoring engine's normalization-and-weighting design. Routine logic-building (Gatekeeper, Echo, Circuit cores), all skin passes, and integration/UI work (sequence wrapper, results screen, shell pages) are comfortably within a mid-tier model's capability and shouldn't consume premium-tier budget.

## 14. What "v1" Realistically Means

In v1: Performance Seeker flow, all five games, honest self-relative scoring, results + email capture + share, responsive + PWA, deployed.

Deferred (correctly): percentiles (need accumulated norms, and a norm-aggregation approach that filters per-domain, not per-session — see §9b), brain-fog & healthy-aging segments, blog/SEO, deep scientific validation and final claim/legal review (doctor/dev team's job), product-site CTA wiring.

Ship the beachhead. Don't try to build the whole vision in one pass.
