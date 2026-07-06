import { describe, expect, it } from "vitest";
import {
  scoreCircuit,
  scoreEcho,
  scoreGatekeeper,
  scoreLockOn,
  scoreTrigger,
} from "../domains";
import {
  circuitRun,
  echoRun,
  gatekeeperRun,
  lockonRound,
  lockonRun,
  triggerRun,
} from "./fixtures";

const rts = (rt: number, n = 25) => Array<number>(n).fill(rt);

describe("scoreTrigger (Speed)", () => {
  it("scores 100 at the 200ms anchor", () => {
    const result = scoreTrigger(triggerRun(rts(200)));
    expect(result).toMatchObject({ status: "scored", score: 100 });
  });

  it("interpolates between anchors (median 250ms → 88)", () => {
    // 250 sits halfway between [200,100] and [300,75] → 87.5, rounded to 88.
    expect(scoreTrigger(triggerRun(rts(250)))).toMatchObject({ score: 88 });
  });

  it("hits interior and floor anchors exactly", () => {
    expect(scoreTrigger(triggerRun(rts(450)))).toMatchObject({ score: 40 });
    expect(scoreTrigger(triggerRun(rts(650)))).toMatchObject({ score: 0 });
    expect(scoreTrigger(triggerRun(rts(1000)))).toMatchObject({ score: 0 });
  });

  it("is monotonic: slower median never scores higher", () => {
    for (let rt = 150; rt < 700; rt += 25) {
      const faster = scoreTrigger(triggerRun(rts(rt)));
      const slower = scoreTrigger(triggerRun(rts(rt + 25)));
      if (faster.status === "scored" && slower.status === "scored") {
        expect(faster.score).toBeGreaterThanOrEqual(slower.score);
      }
    }
  });

  it("computes the median over valid trials only (false starts excluded)", () => {
    const run = triggerRun([...rts(220, 12), ...Array<null>(13).fill(null)]);
    // median 220 → 100 − 20/100·25 = 95
    expect(scoreTrigger(run)).toMatchObject({
      status: "scored",
      score: 95,
      detail: { validTrials: 12, medianRtMs: 220 },
    });
  });

  it("returns insufficient_data below 10 valid trials", () => {
    expect(scoreTrigger(triggerRun(rts(200, 9))).status).toBe(
      "insufficient_data"
    );
  });

  it("excludes discarded trials from validity", () => {
    const run = triggerRun(rts(200)).map((t, i) =>
      i < 20 ? { ...t, discarded: true } : t
    );
    expect(scoreTrigger(run).status).toBe("insufficient_data");
  });
});

describe("scoreGatekeeper (Impulse Control)", () => {
  it("scores 100 for a perfect run at the RT ceiling", () => {
    const run = gatekeeperRun({ goRtMs: 280 });
    expect(scoreGatekeeper(run)).toMatchObject({ status: "scored", score: 100 });
  });

  it("caps the button-masher strategy at 40", () => {
    // All 8 commissions, perfect fast go trials: 0 + 20 + 20.
    const run = gatekeeperRun({ commissions: 8, goRtMs: 280 });
    expect(scoreGatekeeper(run)).toMatchObject({ score: 40 });
  });

  it("caps the never-respond strategy at 60", () => {
    // Perfect no-go withholding but zero go hits and no RT component.
    const run = gatekeeperRun({ goResponded: 0 });
    expect(scoreGatekeeper(run)).toMatchObject({
      score: 60,
      detail: { goHitRate: 0, medianGoRtMs: null },
    });
  });

  it("combines components as specified (1 commission, 440ms go RT → 83)", () => {
    // 0.6·87.5 + 0.2·100 + 0.2·50 = 82.5 → rounds to 83.
    const run = gatekeeperRun({ commissions: 1, goRtMs: 440 });
    expect(scoreGatekeeper(run)).toMatchObject({
      score: 83,
      detail: { commissionErrors: 1, validNoGoTrials: 8 },
    });
  });

  it("returns insufficient_data when too many no-go trials are discarded", () => {
    const run = gatekeeperRun({});
    let marked = 0;
    const damaged = run.map((t) =>
      t.stimulus["type"] === "no-go" && marked++ < 3
        ? { ...t, discarded: true }
        : t
    );
    expect(scoreGatekeeper(damaged).status).toBe("insufficient_data");
  });
});

describe("scoreEcho (Working Memory)", () => {
  it("scores 100 for perfect discrimination", () => {
    const run = echoRun({ hits: 7, misses: 0, falseAlarms: 0 });
    expect(scoreEcho(run)).toMatchObject({ status: "scored", score: 100 });
  });

  it("computes Pr = hit rate − false-alarm rate (hand-computed case)", () => {
    // 6/7 − 2/17 = 0.8571 − 0.1176 = 0.7395 → 74.
    const run = echoRun({ hits: 6, misses: 1, falseAlarms: 2 });
    expect(scoreEcho(run)).toMatchObject({
      score: 74,
      detail: { hits: 6, misses: 1, falseAlarms: 2, correctRejections: 15 },
    });
  });

  it("scores ~0 for responding to everything (mashing)", () => {
    const run = echoRun({ hits: 7, misses: 0, falseAlarms: 17 });
    expect(scoreEcho(run)).toMatchObject({ score: 0 });
  });

  it("scores 0 for never responding", () => {
    const run = echoRun({ hits: 0, misses: 7, falseAlarms: 0 });
    expect(scoreEcho(run)).toMatchObject({ score: 0 });
  });

  it("returns insufficient_data when too many items are discarded", () => {
    const run = echoRun({ hits: 7, misses: 0, falseAlarms: 0 }).map((t, i) =>
      i < 7 ? { ...t, discarded: true } : t
    );
    expect(scoreEcho(run).status).toBe("insufficient_data");
  });
});

describe("scoreCircuit (Flexibility)", () => {
  it("hits the time anchors with no errors", () => {
    expect(scoreCircuit(circuitRun(12_000))).toMatchObject({ score: 100 });
    expect(scoreCircuit(circuitRun(25_000))).toMatchObject({ score: 70 });
    expect(scoreCircuit(circuitRun(75_000))).toMatchObject({ score: 0 });
  });

  it("deducts 3 points per wrong tap", () => {
    expect(scoreCircuit(circuitRun(25_000, 4))).toMatchObject({
      score: 58,
      detail: { completionMs: 25_000, wrongTaps: 4 },
    });
  });

  it("caps the error deduction at 15", () => {
    // 20s → 81.54 base, 10 errors capped at −15 → 66.54 → 67.
    expect(scoreCircuit(circuitRun(20_000, 10))).toMatchObject({ score: 67 });
  });

  it("never goes below 0", () => {
    expect(scoreCircuit(circuitRun(100_000, 10))).toMatchObject({ score: 0 });
  });

  it("returns insufficient_data for an interrupted run", () => {
    const run = circuitRun(20_000, 0, { discarded: true });
    expect(scoreCircuit(run).status).toBe("insufficient_data");
  });

  it("returns insufficient_data for an incomplete run", () => {
    const run = circuitRun(20_000).slice(0, -1); // final node never reached
    expect(scoreCircuit(run).status).toBe("insufficient_data");
  });
});

describe("scoreLockOn (Divided Attention)", () => {
  it("gives 25 points per passed level plus partial credit at the miss", () => {
    // Passed K=3,4 (50) + 3/5 of the K=5 step (15) → 65.
    const run = lockonRun({ passedThroughK: 4, failedAt: { k: 5, correctCount: 3 } });
    expect(scoreLockOn(run)).toMatchObject({
      score: 65,
      detail: {
        highestPassedK: 4,
        reachedCeiling: false,
        failedAttempt: { k: 5, correctCount: 3 },
      },
    });
  });

  it("scores 100 at the test ceiling (K=6 passed)", () => {
    const run = lockonRun({ passedThroughK: 6 });
    expect(scoreLockOn(run)).toMatchObject({
      score: 100,
      detail: { highestPassedK: 6, reachedCeiling: true },
    });
  });

  it("grants only partial credit when no level is passed", () => {
    // 1/3 of the first 25-point step → 8.33 → 8.
    const run = lockonRun({ passedThroughK: null, failedAt: { k: 3, correctCount: 1 } });
    expect(scoreLockOn(run)).toMatchObject({ score: 8 });
  });

  it("scores from passed levels alone when the game ended on discards", () => {
    const run = [
      ...lockonRun({ passedThroughK: 3 }),
      lockonRound(1, 4, 2, { discarded: true }),
      lockonRound(2, 4, 4, { discarded: true }),
    ];
    expect(scoreLockOn(run)).toMatchObject({ score: 25 });
  });

  it("returns insufficient_data with no clean rounds", () => {
    expect(scoreLockOn([]).status).toBe("insufficient_data");
    const allDiscarded = [lockonRound(0, 3, 3, { discarded: true })];
    expect(scoreLockOn(allDiscarded).status).toBe("insufficient_data");
  });
});
