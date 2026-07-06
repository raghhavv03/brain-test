/**
 * Scoring engine types. The scorers are pure functions over rows read back
 * from the Supabase `trials` table, so any past session can be re-scored
 * offline — including under future anchor/weight revisions once norm data
 * exists.
 */

/** A `trials` row as read back from Supabase (subset the scorers need). */
export type StoredTrial = {
  game: string;
  trial_index: number;
  stimulus: Record<string, unknown>;
  response: Record<string, unknown> | null;
  rt_ms: number | null;
  correct: boolean;
  discarded: boolean;
};

export const DOMAIN_KEYS = [
  "speed",
  "impulse_control",
  "working_memory",
  "flexibility",
  "divided_attention",
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

/**
 * A domain either produces a real 0–100 score or explicitly reports that the
 * session didn't yield enough clean data. There is deliberately no fallback
 * score: the results screen must surface `insufficient_data` to the user
 * (grayed-out domain card + "based on N of 5 areas" caption on the headline),
 * never invent a number for it.
 */
export type DomainScore<Detail = Record<string, unknown>> =
  | { status: "scored"; score: number; detail: Detail }
  | { status: "insufficient_data"; reason: string };

export type TriggerDetail = { validTrials: number; medianRtMs: number };

export type GatekeeperDetail = {
  validNoGoTrials: number;
  commissionErrors: number;
  noGoAccuracy: number;
  goHitRate: number;
  medianGoRtMs: number | null;
};

export type EchoDetail = {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  hitRate: number;
  falseAlarmRate: number;
};

export type CircuitDetail = { completionMs: number; wrongTaps: number };

export type LockOnDetail = {
  highestPassedK: number | null;
  reachedCeiling: boolean;
  failedAttempt: { k: number; correctCount: number } | null;
};

export type DomainScores = {
  speed: DomainScore<TriggerDetail>;
  impulse_control: DomainScore<GatekeeperDetail>;
  working_memory: DomainScore<EchoDetail>;
  flexibility: DomainScore<CircuitDetail>;
  divided_attention: DomainScore<LockOnDetail>;
};

export type Headline =
  | {
      status: "scored";
      score: number;
      band: string;
      /** How many of the 5 domains the headline is based on — the results
       * screen must display this whenever it is < 5. */
      basedOnDomains: number;
    }
  | { status: "insufficient"; reason: string; scoredDomains: number };

export type BrainScoreResult = {
  domains: DomainScores;
  headline: Headline;
};
