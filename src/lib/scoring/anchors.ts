/**
 * SCORING ANCHORS & WEIGHTS — v1, criterion-referenced.
 *
 * There is no population norm data yet, so every 0–100 mapping in this file
 * is anchored to fixed criterion points chosen from task structure and
 * published task literature — NOT calibrated against real users. Scores are
 * self-relative/descriptive only; nothing here supports percentile or
 * population claims, and the results screen must never imply them.
 *
 * Every constant below is a reviewable decision for the doctor's team. Raw
 * trials are always stored, so all sessions can be re-scored when these
 * values are revised.
 *
 * Anchor format: [rawValue, score] points, ascending by rawValue, linearly
 * interpolated between points and clamped flat beyond the ends.
 */

/** [rawValue, score] pairs, ascending by raw value. */
export type AnchorTable = readonly (readonly [number, number])[];

// ---------------------------------------------------------------------------
// Speed — Trigger (simple reaction time)
// ---------------------------------------------------------------------------

/**
 * Median RT (ms) over valid trials → score. Lab-grade simple visual RT for
 * healthy adults centers around 220–300 ms; browser + touchscreen input adds
 * tens of ms of latency, so 200 ms is already an elite result on this
 * hardware and anything past ~650 ms reflects sustained lapses, not speed.
 */
export const TRIGGER_RT_ANCHORS: AnchorTable = [
  [200, 100],
  [300, 75],
  [450, 40],
  [650, 0],
];

/** Below this many valid (correct, non-discarded) trials out of ~25, a
 * median RT is too noisy to report. */
export const TRIGGER_MIN_VALID_TRIALS = 10;

// ---------------------------------------------------------------------------
// Impulse Control — Gatekeeper (go/no-go)
// ---------------------------------------------------------------------------

/**
 * Component weights. Commission errors (responding on no-go) are the primary
 * impulse-control measure, hence the dominant weight — but scoring
 * commissions alone would award 100 to someone who never responds at all, so
 * go hit rate and go speed keep the "just withhold everything" strategy from
 * winning. Weights sum to 1.
 */
export const GATEKEEPER_WEIGHTS = {
  noGoAccuracy: 0.6,
  goHitRate: 0.2,
  goSpeed: 0.2,
} as const;

/**
 * Median correct-go RT (ms) → speed component. The response window is 600 ms
 * (see gatekeeper page), so the floor sits at the window edge; ~280 ms is a
 * fast-but-controlled response under a 500 ms ISI.
 */
export const GATEKEEPER_GO_RT_ANCHORS: AnchorTable = [
  [280, 100],
  [600, 0],
];

/**
 * Known granularity limit: with the fixed 8-no-go structure the commission
 * component moves in 12.5% steps. That is a property of the task skeleton
 * (fixed science) — do not enlarge the no-go count to smooth the score.
 */
export const GATEKEEPER_MIN_VALID_NOGO = 6;
export const GATEKEEPER_MIN_VALID_GO = 20;

// ---------------------------------------------------------------------------
// Working Memory — Echo (2-back)
// ---------------------------------------------------------------------------

/**
 * Score = Pr × 100, where Pr = hit rate − false-alarm rate (two-high-threshold
 * discrimination index; Snodgrass & Corwin 1988), clamped at 0. Chosen over
 * d′ because Pr needs no edge corrections for perfect/zero rates and maps
 * directly onto a 0–100 consumer scale. Random responding and blanket
 * non-responding both land near 0 by construction.
 */
export const ECHO_MIN_VALID_ITEMS = 18;
export const ECHO_MIN_TARGETS_SEEN = 5;

// ---------------------------------------------------------------------------
// Flexibility — Circuit (trail-making B)
// ---------------------------------------------------------------------------

/**
 * Completion time (first tap → final correct tap, ms) → score. Published
 * TMT-B norms don't transfer to this 16-node touch board, so anchors are
 * reasoned from its structure: 15 inter-tap moves at a brisk ~800 ms each
 * ≈ 12 s (ceiling); ≥75 s means the alternation rule never stabilized.
 */
export const CIRCUIT_TIME_ANCHORS: AnchorTable = [
  [12_000, 100],
  [25_000, 70],
  [45_000, 35],
  [75_000, 0],
];

/**
 * Wrong taps already inflate completion time (they must be corrected before
 * advancing), so the explicit per-error deduction stays small to avoid
 * double-counting; the cap keeps one confused stretch from zeroing the domain.
 */
export const CIRCUIT_ERROR_PENALTY = 3;
export const CIRCUIT_ERROR_PENALTY_CAP = 15;

// ---------------------------------------------------------------------------
// Divided Attention — Lock-On (multiple object tracking)
// ---------------------------------------------------------------------------

/**
 * The staircase runs K = 3..6, so there are 4 pass levels; 25 points per
 * fully-passed level makes the span the primary measure, and accuracy on the
 * final (failed) attempt grants partial credit within the next 25-point step
 * so the score isn't limited to 4 coarse values. Passing K = 6 is the test
 * ceiling (100) — report it as "reached the test ceiling", not as a maximum
 * human capacity.
 */
export const LOCKON_POINTS_PER_LEVEL = 25;

// ---------------------------------------------------------------------------
// Headline Brain Score
// ---------------------------------------------------------------------------

/**
 * v1 HEADLINE WEIGHTS — PLACEHOLDER DECISION, NOT A VALIDATED CONCLUSION.
 *
 * Equal weighting is a substantive simplifying choice, not a neutral one: it
 * asserts that all five domains contribute equally to the headline, a claim
 * we currently have no validity data to support (nor to support any other
 * ranking). It was chosen because it is transparent and makes no hidden
 * importance claims. Known tradeoff: the five sub-scores differ in
 * measurement reliability (e.g. Speed rests on ~25 trials, Impulse Control's
 * commission rate on only 8 no-go trials), and equal weights ignore that.
 * For the doctor's team: revisit once norm data accumulates — raw trials are
 * stored, so every past session can be re-scored under revised weights.
 *
 * Expressed as integer percents (summing to 100) so the renormalized
 * weighted mean stays exact integer arithmetic — fractional weights like 0.2
 * introduce float noise exactly at .5 rounding boundaries.
 */
export const DOMAIN_WEIGHTS = {
  speed: 20,
  impulse_control: 20,
  working_memory: 20,
  flexibility: 20,
  divided_attention: 20,
} as const;

/**
 * A headline is only computed when at least this many domains scored; the
 * remaining domains' weights are renormalized over the scored ones, and the
 * results screen must visibly say "based on N of 5 areas". Below the
 * threshold the session gets domain scores only, no headline.
 */
export const MIN_DOMAINS_FOR_HEADLINE = 3;

/**
 * Band labels describe THIS SESSION's test performance — plain, self-relative
 * language only. No health, clinical, or population-comparison wording.
 */
export const BANDS: readonly { min: number; label: string }[] = [
  { min: 85, label: "Peak session" },
  { min: 70, label: "Strong" },
  { min: 55, label: "Solid" },
  { min: 40, label: "Mixed" },
  { min: 0, label: "Off day" },
];
