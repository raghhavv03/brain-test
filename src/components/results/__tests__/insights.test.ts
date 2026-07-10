import { describe, expect, it } from "vitest";
import type { DomainScore, DomainScores } from "@/lib/scoring/types";
import { pickInsights } from "../insights";

function scored(score: number): DomainScore {
  return { status: "scored", score, detail: {} };
}

const insufficient: DomainScore = {
  status: "insufficient_data",
  reason: "test reason",
};

function domains(partial: Partial<DomainScores>): DomainScores {
  return {
    speed: insufficient,
    impulse_control: insufficient,
    working_memory: insufficient,
    flexibility: insufficient,
    divided_attention: insufficient,
    ...partial,
  } as DomainScores;
}

describe("pickInsights", () => {
  it("picks highest as strength and lowest as growth from a full run", () => {
    const result = pickInsights(
      domains({
        speed: scored(72),
        impulse_control: scored(54),
        working_memory: scored(88),
        flexibility: scored(61),
        divided_attention: scored(45),
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
        speed: scored(72),
        impulse_control: scored(54),
        working_memory: scored(88),
        flexibility: scored(61),
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
        speed: scored(80),
        impulse_control: scored(80),
        working_memory: scored(30),
        flexibility: scored(30),
        divided_attention: scored(50),
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
        speed: scored(65),
        impulse_control: scored(65),
        working_memory: scored(65),
      })
    );
    expect(result).toEqual({ kind: "balanced", score: 65, scoredCount: 3 });
  });

  it("treats two equal scored domains as balanced, not a fabricated pair", () => {
    const result = pickInsights(
      domains({ speed: scored(50), flexibility: scored(50) })
    );
    expect(result).toEqual({ kind: "balanced", score: 50, scoredCount: 2 });
  });

  it("returns a pair for exactly two scored domains with different scores", () => {
    const result = pickInsights(
      domains({ speed: scored(40), flexibility: scored(70) })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "flexibility", score: 70 },
      growth: { key: "speed", score: 40 },
    });
  });

  it("declines both slots with a single scored domain", () => {
    expect(pickInsights(domains({ speed: scored(90) }))).toEqual({
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
      domains({ speed: scored(0), working_memory: scored(60), flexibility: scored(35) })
    );
    expect(result).toEqual({
      kind: "pair",
      strength: { key: "working_memory", score: 60 },
      growth: { key: "speed", score: 0 },
    });
  });
});
