/**
 * Domain scorers — pure functions from raw trial rows to a 0–100 sub-score
 * (or an explicit `insufficient_data`). Discarded (tab-hidden) trials are
 * excluded from every computation; they were saved for the record, not for
 * scoring. All anchor values and thresholds live in anchors.ts.
 */

import { SEQUENCE } from "@/lib/circuit/board";
import { MAX_K, START_K } from "@/lib/lockon/round";
import {
  CIRCUIT_ERROR_PENALTY,
  CIRCUIT_ERROR_PENALTY_CAP,
  CIRCUIT_TIME_ANCHORS,
  ECHO_MIN_TARGETS_SEEN,
  ECHO_MIN_VALID_ITEMS,
  GATEKEEPER_GO_RT_ANCHORS,
  GATEKEEPER_MIN_VALID_GO,
  GATEKEEPER_MIN_VALID_NOGO,
  GATEKEEPER_WEIGHTS,
  LOCKON_POINTS_PER_LEVEL,
  TRIGGER_MIN_VALID_TRIALS,
  TRIGGER_RT_ANCHORS,
  type AnchorTable,
} from "./anchors";
import type {
  CircuitDetail,
  DomainScore,
  EchoDetail,
  GatekeeperDetail,
  LockOnDetail,
  StoredTrial,
  TriggerDetail,
} from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Linear interpolation over an anchor table, clamped flat beyond the ends. */
function piecewise(value: number, anchors: AnchorTable): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (value <= x1) {
      const [x0, y0] = anchors[i - 1];
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

/** Safe numeric read from a jsonb column. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------

export function scoreTrigger(
  trials: StoredTrial[]
): DomainScore<TriggerDetail> {
  // False starts and misses are saved with correct = false and rt_ms = null,
  // so filtering on `correct` excludes them from the median automatically.
  const valid = trials.filter(
    (t) => !t.discarded && t.correct && t.rt_ms !== null
  );
  if (valid.length < TRIGGER_MIN_VALID_TRIALS) {
    return {
      status: "insufficient_data",
      reason: `Only ${valid.length} clean reaction-time trials; need at least ${TRIGGER_MIN_VALID_TRIALS}.`,
    };
  }
  const medianRtMs = median(valid.map((t) => t.rt_ms as number));
  return {
    status: "scored",
    score: Math.round(piecewise(medianRtMs, TRIGGER_RT_ANCHORS)),
    detail: { validTrials: valid.length, medianRtMs },
  };
}

export function scoreGatekeeper(
  trials: StoredTrial[]
): DomainScore<GatekeeperDetail> {
  const valid = trials.filter((t) => !t.discarded);
  const noGo = valid.filter((t) => t.stimulus["type"] === "no-go");
  const go = valid.filter((t) => t.stimulus["type"] === "go");
  if (noGo.length < GATEKEEPER_MIN_VALID_NOGO || go.length < GATEKEEPER_MIN_VALID_GO) {
    return {
      status: "insufficient_data",
      reason: `Only ${noGo.length} clean no-go and ${go.length} clean go trials; need at least ${GATEKEEPER_MIN_VALID_NOGO} and ${GATEKEEPER_MIN_VALID_GO}.`,
    };
  }

  const commissionErrors = noGo.filter((t) => !t.correct).length;
  const noGoAccuracy = 1 - commissionErrors / noGo.length;
  const correctGo = go.filter((t) => t.correct && t.rt_ms !== null);
  const goHitRate = correctGo.length / go.length;
  const medianGoRtMs =
    correctGo.length > 0 ? median(correctGo.map((t) => t.rt_ms as number)) : null;
  const goSpeedScore =
    medianGoRtMs === null ? 0 : piecewise(medianGoRtMs, GATEKEEPER_GO_RT_ANCHORS);

  const score =
    GATEKEEPER_WEIGHTS.noGoAccuracy * noGoAccuracy * 100 +
    GATEKEEPER_WEIGHTS.goHitRate * goHitRate * 100 +
    GATEKEEPER_WEIGHTS.goSpeed * goSpeedScore;
  return {
    status: "scored",
    score: Math.round(clamp(score, 0, 100)),
    detail: {
      validNoGoTrials: noGo.length,
      commissionErrors,
      noGoAccuracy,
      goHitRate,
      medianGoRtMs,
    },
  };
}

export function scoreEcho(trials: StoredTrial[]): DomainScore<EchoDetail> {
  const valid = trials.filter((t) => !t.discarded);
  const count = (c: string) =>
    valid.filter((t) => t.stimulus["classification"] === c).length;
  const hits = count("hit");
  const misses = count("miss");
  const falseAlarms = count("false_alarm");
  const correctRejections = count("correct_rejection");
  const targetsSeen = hits + misses;
  const nonTargetsSeen = falseAlarms + correctRejections;
  if (
    valid.length < ECHO_MIN_VALID_ITEMS ||
    targetsSeen < ECHO_MIN_TARGETS_SEEN ||
    nonTargetsSeen === 0
  ) {
    return {
      status: "insufficient_data",
      reason: `Only ${valid.length} clean items (${targetsSeen} targets); need at least ${ECHO_MIN_VALID_ITEMS} items and ${ECHO_MIN_TARGETS_SEEN} targets.`,
    };
  }
  const hitRate = hits / targetsSeen;
  const falseAlarmRate = falseAlarms / nonTargetsSeen;
  const pr = clamp(hitRate - falseAlarmRate, 0, 1);
  return {
    status: "scored",
    score: Math.round(pr * 100),
    detail: {
      hits,
      misses,
      falseAlarms,
      correctRejections,
      hitRate,
      falseAlarmRate,
    },
  };
}

export function scoreCircuit(
  trials: StoredTrial[]
): DomainScore<CircuitDetail> {
  // Circuit saves one visibility flag for the whole run, stamped on every tap.
  if (trials.length === 0 || trials.some((t) => t.discarded)) {
    return {
      status: "insufficient_data",
      reason:
        trials.length === 0
          ? "No circuit taps recorded."
          : "The run was interrupted (tab lost focus), so its time can't be trusted.",
    };
  }
  const correctTaps = trials.filter((t) => t.correct);
  if (correctTaps.length !== SEQUENCE.length) {
    return {
      status: "insufficient_data",
      reason: `Run incomplete: ${correctTaps.length} of ${SEQUENCE.length} nodes reached.`,
    };
  }
  // Completion time = first tap of the run → final correct tap, reconstructed
  // from elapsed_since_first_tap_ms on the raw rows.
  const elapsed = correctTaps
    .map((t) => num(t.response?.["elapsed_since_first_tap_ms"]))
    .filter((v): v is number => v !== null);
  if (elapsed.length !== correctTaps.length) {
    return {
      status: "insufficient_data",
      reason: "Some taps are missing elapsed-time data.",
    };
  }
  const completionMs = Math.max(...elapsed);
  const wrongTaps = trials.length - correctTaps.length;
  const score =
    piecewise(completionMs, CIRCUIT_TIME_ANCHORS) -
    Math.min(wrongTaps * CIRCUIT_ERROR_PENALTY, CIRCUIT_ERROR_PENALTY_CAP);
  return {
    status: "scored",
    score: Math.round(clamp(score, 0, 100)),
    detail: { completionMs, wrongTaps },
  };
}

export function scoreLockOn(trials: StoredTrial[]): DomainScore<LockOnDetail> {
  const valid = trials.filter((t) => !t.discarded);
  if (valid.length === 0) {
    return {
      status: "insufficient_data",
      reason: "No clean tracking rounds recorded.",
    };
  }

  const kOf = (t: StoredTrial) => num(t.stimulus["k"]) ?? 0;
  const passed = valid.filter((t) => t.correct);
  const highestPassedK = passed.length > 0 ? Math.max(...passed.map(kOf)) : null;
  // The staircase ends on the first miss, so there is at most one failed
  // round; taking the highest-K one is defensive against odd data.
  const failed = valid.filter((t) => !t.correct);
  const failedRound =
    failed.length > 0
      ? failed.reduce((a, b) => (kOf(a) >= kOf(b) ? a : b))
      : null;

  // Levels passed = k − (START_K − 1), e.g. passing K=3 is 1 level.
  const base =
    highestPassedK === null
      ? 0
      : (highestPassedK - (START_K - 1)) * LOCKON_POINTS_PER_LEVEL;
  const failedK = failedRound ? kOf(failedRound) : null;
  const failedCorrectCount = failedRound
    ? num(failedRound.response?.["correct_count"]) ?? 0
    : null;
  const partial =
    failedRound && failedK
      ? ((failedCorrectCount ?? 0) / failedK) * LOCKON_POINTS_PER_LEVEL
      : 0;

  return {
    status: "scored",
    score: Math.round(clamp(base + partial, 0, 100)),
    detail: {
      highestPassedK,
      reachedCeiling: highestPassedK === MAX_K,
      failedAttempt:
        failedRound && failedK !== null && failedCorrectCount !== null
          ? { k: failedK, correctCount: failedCorrectCount }
          : null,
    },
  };
}
