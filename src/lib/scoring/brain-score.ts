/**
 * Headline Brain Score — combines the five domain sub-scores into one number
 * plus a band label. Pure function; Supabase I/O lives in session.ts.
 *
 * Self-relative/descriptive only: no percentiles, no population comparisons
 * (no norm data exists yet), no medical claims.
 */

import { BANDS, DOMAIN_WEIGHTS, MIN_DOMAINS_FOR_HEADLINE } from "./anchors";
import {
  scoreCircuit,
  scoreEcho,
  scoreGatekeeper,
  scoreLockOn,
  scoreTrigger,
} from "./domains";
import {
  DOMAIN_KEYS,
  type BrainScoreResult,
  type DomainScores,
  type StoredTrial,
} from "./types";

export function bandFor(score: number): string {
  const band = BANDS.find((b) => score >= b.min);
  if (!band) throw new Error(`No band covers score ${score}.`);
  return band.label;
}

export function computeBrainScore(trials: StoredTrial[]): BrainScoreResult {
  const byGame = new Map<string, StoredTrial[]>();
  for (const t of trials) {
    const rows = byGame.get(t.game);
    if (rows) rows.push(t);
    else byGame.set(t.game, [t]);
  }
  const rows = (game: string) => byGame.get(game) ?? [];

  const domains: DomainScores = {
    speed: scoreTrigger(rows("trigger")),
    impulse_control: scoreGatekeeper(rows("gatekeeper")),
    working_memory: scoreEcho(rows("echo")),
    flexibility: scoreCircuit(rows("circuit")),
    divided_attention: scoreLockOn(rows("lockon")),
  };

  const scored = DOMAIN_KEYS.filter((k) => domains[k].status === "scored");
  if (scored.length < MIN_DOMAINS_FOR_HEADLINE) {
    return {
      domains,
      headline: {
        status: "insufficient",
        reason: `Only ${scored.length} of ${DOMAIN_KEYS.length} areas produced enough clean data; need at least ${MIN_DOMAINS_FOR_HEADLINE} for a headline score.`,
        scoredDomains: scored.length,
      },
    };
  }

  // Weighted mean over the scored domains, weights renormalized so missing
  // domains don't drag the headline down. (With v1's equal weights this is a
  // plain average, but the arithmetic is written for general weights so a
  // future reweighting only touches anchors.ts.)
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of scored) {
    const domain = domains[key];
    if (domain.status !== "scored") continue;
    weightedSum += DOMAIN_WEIGHTS[key] * domain.score;
    weightTotal += DOMAIN_WEIGHTS[key];
  }
  const score = Math.round(weightedSum / weightTotal);

  return {
    domains,
    headline: {
      status: "scored",
      score,
      band: bandFor(score),
      basedOnDomains: scored.length,
    },
  };
}
