import { describe, expect, it } from "vitest";
import type {
  CircuitDetail,
  DomainScore,
  DomainScores,
  EchoDetail,
  GatekeeperDetail,
  LockOnDetail,
  TriggerDetail,
} from "@/lib/scoring/types";
import { pickInsights } from "../insights";

// The insufficient_data variant carries no generic-dependent field, so this
// narrow literal (not widened to DomainScore's default detail generic)
// structurally satisfies DomainScore<T> for every domain's T.
const insufficient = { status: "insufficient_data", reason: "test reason" } as const;

// Representative detail fixtures per domain. pickInsights never reads
// .detail (only .status/.score — see insights.ts), so the values themselves
// are arbitrary; they exist only so each domain's DomainScore<T> is
// structurally correct, matching the real scorer output shapes in
// src/lib/scoring/types.ts.
const TRIGGER_DETAIL: TriggerDetail = { validTrials: 20, medianRtMs: 300 };
const GATEKEEPER_DETAIL: GatekeeperDetail = {
  validNoGoTrials: 8,
  commissionErrors: 1,
  noGoAccuracy: 0.9,
  goHitRate: 0.95,
  medianGoRtMs: 350,
};
const ECHO_DETAIL: EchoDetail = {
  hits: 5,
  misses: 1,
  falseAlarms: 1,
  correctRejections: 15,
  hitRate: 0.8,
  falseAlarmRate: 0.1,
};
const CIRCUIT_DETAIL: CircuitDetail = { completionMs: 15000, wrongTaps: 1 };
const LOCKON_DETAIL: LockOnDetail = {
  highestPassedK: 5,
  reachedCeiling: false,
  failedAttempt: null,
};

function scoredSpeed(score: number): DomainScore<TriggerDetail> {
  return { status: "scored", score, detail: TRIGGER_DETAIL };
}
function scoredImpulseControl(score: number): DomainScore<GatekeeperDetail> {
  return { status: "scored", score, detail: GATEKEEPER_DETAIL };
}
function scoredWorkingMemory(score: number): DomainScore<EchoDetail> {
  return { status: "scored", score, detail: ECHO_DETAIL };
}
function scoredFlexibility(score: number): DomainScore<CircuitDetail> {
  return { status: "scored", score, detail: CIRCUIT_DETAIL };
}
function scoredDividedAttention(score: number): DomainScore<LockOnDetail> {
  return { status: "scored", score, detail: LOCKON_DETAIL };
}

function domains(partial: Partial<DomainScores>): DomainScores {
  return {
    speed: insufficient,
    impulse_control: insufficient,
    working_memory: insufficient,
    flexibility: insufficient,
    divided_attention: insufficient,
    ...partial,
  };
}

describe("pickInsights", () => {
  it("picks highest as strength and lowest as growth from a full run", () => {
    const result = pickInsights(
      domains({
        speed: scoredSpeed(72),
        impulse_control: scoredImpulseControl(54),
        working_memory: scoredWorkingMemory(88),
        flexibility: scoredFlexibility(61),
        divided_attention: scoredDividedAttention(45),
      })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "working_memory", score: 88 },
      growth: { key: "divided_attention", score: 45 },
    });
  });

  it("never picks an insufficient_data domain for either slot", () => {
    // divided_attention would be the lowest if a missing measurement were
    // (wrongly) treated as 0; growth must come from scored domains only.
    const result = pickInsights(
      domains({
        speed: scoredSpeed(72),
        impulse_control: scoredImpulseControl(54),
        working_memory: scoredWorkingMemory(88),
        flexibility: scoredFlexibility(61),
      })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "working_memory", score: 88 },
      growth: { key: "impulse_control", score: 54 },
    });
  });

  it("breaks ties by canonical domain order (first tied domain wins)", () => {
    const result = pickInsights(
      domains({
        speed: scoredSpeed(80),
        impulse_control: scoredImpulseControl(80),
        working_memory: scoredWorkingMemory(30),
        flexibility: scoredFlexibility(30),
        divided_attention: scoredDividedAttention(50),
      })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "speed", score: 80 },
      growth: { key: "working_memory", score: 30 },
    });
  });

  it("reports a balanced profile when all scored domains are equal", () => {
    const result = pickInsights(
      domains({
        speed: scoredSpeed(65),
        impulse_control: scoredImpulseControl(65),
        working_memory: scoredWorkingMemory(65),
      })
    );
    expect(result).toEqual({ kind: "balanced", score: 65, scoredCount: 3 });
  });

  it("treats two equal scored domains as balanced, not a fabricated pair", () => {
    const result = pickInsights(
      domains({ speed: scoredSpeed(50), flexibility: scoredFlexibility(50) })
    );
    expect(result).toEqual({ kind: "balanced", score: 50, scoredCount: 2 });
  });

  it("returns a pair for exactly two scored domains with different scores", () => {
    const result = pickInsights(
      domains({ speed: scoredSpeed(40), flexibility: scoredFlexibility(70) })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "flexibility", score: 70 },
      growth: { key: "speed", score: 40 },
    });
  });

  it("declines both slots with a single scored domain", () => {
    expect(pickInsights(domains({ speed: scoredSpeed(90) }))).toEqual({
      kind: "not_enough",
      scoredCount: 1,
    });
  });

  it("declines both slots when nothing scored", () => {
    expect(pickInsights(domains({}))).toEqual({
      kind: "not_enough",
      scoredCount: 0,
    });
  });

  it("still pairs when scores include a genuine 0", () => {
    // 0 is a real score (e.g. chance-level Echo) and must be usable as the
    // growth slot, unlike insufficient_data which is excluded entirely.
    const result = pickInsights(
      domains({
        speed: scoredSpeed(0),
        working_memory: scoredWorkingMemory(60),
        flexibility: scoredFlexibility(35),
      })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "working_memory", score: 60 },
      growth: { key: "speed", score: 0 },
    });
  });
});
