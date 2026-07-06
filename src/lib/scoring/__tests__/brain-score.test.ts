import { describe, expect, it } from "vitest";
import { bandFor, computeBrainScore } from "../brain-score";
import {
  circuitRun,
  echoRun,
  gatekeeperRun,
  lockonRun,
  triggerRun,
} from "./fixtures";

/**
 * A full mixed-performance session with hand-computed domain scores:
 * speed 88, impulse 91, working memory 74, flexibility 70, divided 65.
 */
function mixedSession() {
  return [
    ...triggerRun(Array<number>(25).fill(250)), // median 250 → 88
    ...gatekeeperRun({ commissions: 1, goRtMs: 300 }), // 52.5+20+18.75 → 91
    ...echoRun({ hits: 6, misses: 1, falseAlarms: 2 }), // Pr 0.7395 → 74
    ...circuitRun(25_000), // → 70
    ...lockonRun({ passedThroughK: 4, failedAt: { k: 5, correctCount: 3 } }), // → 65
  ];
}

describe("computeBrainScore", () => {
  it("averages all five domains with equal weights", () => {
    const result = computeBrainScore(mixedSession());
    // (88 + 91 + 74 + 70 + 65) / 5 = 77.6 → 78.
    expect(result.headline).toEqual({
      status: "scored",
      score: 78,
      band: "Strong",
      basedOnDomains: 5,
    });
  });

  it("scores a perfect session at 100 / Peak session", () => {
    const session = [
      ...triggerRun(Array<number>(25).fill(200)),
      ...gatekeeperRun({ goRtMs: 280 }),
      ...echoRun({ hits: 7, misses: 0, falseAlarms: 0 }),
      ...circuitRun(12_000),
      ...lockonRun({ passedThroughK: 6 }),
    ];
    expect(computeBrainScore(session).headline).toMatchObject({
      score: 100,
      band: "Peak session",
    });
  });

  it("renormalizes over scored domains and reports basedOnDomains", () => {
    // Drop echo entirely → working_memory is insufficient_data.
    const session = mixedSession().filter((t) => t.game !== "echo");
    const result = computeBrainScore(session);
    expect(result.domains.working_memory.status).toBe("insufficient_data");
    // (88 + 91 + 70 + 65) / 4 = 78.5 → 79 — not dragged down by the gap.
    expect(result.headline).toMatchObject({
      status: "scored",
      score: 79,
      basedOnDomains: 4,
    });
  });

  it("refuses a headline below 3 scored domains but keeps sub-scores", () => {
    const session = mixedSession().filter(
      (t) => t.game === "trigger" || t.game === "circuit"
    );
    const result = computeBrainScore(session);
    expect(result.headline).toMatchObject({
      status: "insufficient",
      scoredDomains: 2,
    });
    expect(result.domains.speed).toMatchObject({ score: 88 });
    expect(result.domains.flexibility).toMatchObject({ score: 70 });
  });

  it("handles a fully empty session", () => {
    const result = computeBrainScore([]);
    expect(result.headline.status).toBe("insufficient");
    for (const domain of Object.values(result.domains)) {
      expect(domain.status).toBe("insufficient_data");
    }
  });
});

describe("bandFor", () => {
  it("assigns bands at the documented boundaries", () => {
    expect(bandFor(100)).toBe("Peak session");
    expect(bandFor(85)).toBe("Peak session");
    expect(bandFor(84)).toBe("Strong");
    expect(bandFor(70)).toBe("Strong");
    expect(bandFor(69)).toBe("Solid");
    expect(bandFor(55)).toBe("Solid");
    expect(bandFor(54)).toBe("Mixed");
    expect(bandFor(40)).toBe("Mixed");
    expect(bandFor(39)).toBe("Off day");
    expect(bandFor(0)).toBe("Off day");
  });
});
