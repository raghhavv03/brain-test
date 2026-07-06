/**
 * Synthetic trial-row builders for scoring tests. Shapes mirror exactly what
 * each game page saves via saveTrial() — if a game's payload changes, update
 * here and re-verify against a real Supabase session.
 */

import { SEQUENCE } from "@/lib/circuit/board";
import type { StoredTrial } from "../types";

type Overrides = Partial<StoredTrial>;

export function triggerTrial(
  trialIndex: number,
  rtMs: number | null,
  overrides: Overrides = {}
): StoredTrial {
  const correct = rtMs !== null;
  return {
    game: "trigger",
    trial_index: trialIndex,
    stimulus: { foreperiod_ms: 2000 },
    response: correct ? { type: "pointerdown" } : null,
    rt_ms: rtMs,
    correct,
    discarded: false,
    ...overrides,
  };
}

/** A full Trigger run: one trial per entry, null = false start/miss. */
export function triggerRun(rts: (number | null)[]): StoredTrial[] {
  return rts.map((rt, i) => triggerTrial(i, rt));
}

export function gatekeeperTrial(
  trialIndex: number,
  type: "go" | "no-go",
  opts: { responded: boolean; rtMs?: number },
  overrides: Overrides = {}
): StoredTrial {
  // go: correct iff responded in window; no-go: correct iff withheld.
  const correct = type === "go" ? opts.responded : !opts.responded;
  return {
    game: "gatekeeper",
    trial_index: trialIndex,
    stimulus: { type },
    response: opts.responded ? { type: "pointerdown" } : null,
    rt_ms: opts.responded ? opts.rtMs ?? 300 : null,
    correct,
    discarded: false,
    ...overrides,
  };
}

/** 32 go + 8 no-go, interleaved go-first. */
export function gatekeeperRun(opts: {
  goResponded?: number; // of 32
  goRtMs?: number;
  commissions?: number; // of 8
}): StoredTrial[] {
  const goResponded = opts.goResponded ?? 32;
  const commissions = opts.commissions ?? 0;
  const trials: StoredTrial[] = [];
  for (let i = 0; i < 32; i++) {
    trials.push(
      gatekeeperTrial(trials.length, "go", {
        responded: i < goResponded,
        rtMs: opts.goRtMs ?? 300,
      })
    );
  }
  for (let i = 0; i < 8; i++) {
    trials.push(
      gatekeeperTrial(trials.length, "no-go", { responded: i < commissions })
    );
  }
  return trials;
}

export type EchoClassification =
  | "hit"
  | "false_alarm"
  | "miss"
  | "correct_rejection";

export function echoItem(
  itemIndex: number,
  classification: EchoClassification,
  overrides: Overrides = {}
): StoredTrial {
  const isTarget = classification === "hit" || classification === "miss";
  const responded =
    classification === "hit" || classification === "false_alarm";
  return {
    game: "echo",
    trial_index: itemIndex,
    stimulus: { letter: "K", is_target: isTarget, classification },
    response: responded ? { type: "keydown", key: " " } : null,
    rt_ms: responded ? 550 : null,
    correct: classification === "hit" || classification === "correct_rejection",
    discarded: false,
    ...overrides,
  };
}

/** 24 items with the given counts (must sum to ≤ 24; rest correct_rejection). */
export function echoRun(counts: {
  hits: number;
  misses: number;
  falseAlarms: number;
}): StoredTrial[] {
  const items: StoredTrial[] = [];
  const push = (c: EchoClassification, n: number) => {
    for (let i = 0; i < n; i++) items.push(echoItem(items.length, c));
  };
  push("hit", counts.hits);
  push("miss", counts.misses);
  push("false_alarm", counts.falseAlarms);
  push("correct_rejection", 24 - items.length);
  return items;
}

export function circuitTap(
  trialIndex: number,
  expected: string,
  tapped: string,
  elapsedMs: number,
  overrides: Overrides = {}
): StoredTrial {
  return {
    game: "circuit",
    trial_index: trialIndex,
    stimulus: { expected, sequence_position: SEQUENCE.indexOf(expected as never) },
    response: { tapped, elapsed_since_first_tap_ms: elapsedMs },
    rt_ms: 900,
    correct: expected === tapped,
    discarded: false,
    ...overrides,
  };
}

/**
 * A completed run: 16 correct taps evenly spaced so the final tap lands at
 * completionMs, plus wrongTaps errors inserted mid-run.
 */
export function circuitRun(
  completionMs: number,
  wrongTaps = 0,
  overrides: Overrides = {}
): StoredTrial[] {
  const taps: StoredTrial[] = [];
  const step = completionMs / (SEQUENCE.length - 1);
  SEQUENCE.forEach((node, i) => {
    taps.push(circuitTap(taps.length, node, node, Math.round(i * step), overrides));
  });
  for (let i = 0; i < wrongTaps; i++) {
    taps.push(
      circuitTap(taps.length, "4", "7", Math.round(completionMs / 2), overrides)
    );
  }
  return taps;
}

export function lockonRound(
  roundIndex: number,
  k: number,
  correctCount: number,
  overrides: Overrides = {}
): StoredTrial {
  return {
    game: "lockon",
    trial_index: roundIndex,
    stimulus: {
      k,
      num_objects: 2 * k,
      target_indices: Array.from({ length: k }, (_, i) => i),
      mark_ms: 1500 + 250 * k,
      motion_ms: 6000,
      mark_ms_measured: 1500 + 250 * k,
      motion_ms_measured: 6000,
    },
    response: {
      selected_indices: Array.from({ length: k }, (_, i) => i),
      correct_count: correctCount,
      accuracy: correctCount / k,
    },
    rt_ms: null,
    correct: correctCount === k,
    discarded: false,
    ...overrides,
  };
}

/** Staircase from K=3: pass every listed level, then optionally fail. */
export function lockonRun(opts: {
  passedThroughK: number | null; // e.g. 4 = passed K=3 and K=4; null = none
  failedAt?: { k: number; correctCount: number };
}): StoredTrial[] {
  const rounds: StoredTrial[] = [];
  if (opts.passedThroughK !== null) {
    for (let k = 3; k <= opts.passedThroughK; k++) {
      rounds.push(lockonRound(rounds.length, k, k));
    }
  }
  if (opts.failedAt) {
    rounds.push(
      lockonRound(rounds.length, opts.failedAt.k, opts.failedAt.correctCount)
    );
  }
  return rounds;
}
