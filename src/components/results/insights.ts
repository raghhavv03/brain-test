/**
 * Strength / growth-area picker for the results screen.
 *
 * Honesty rules (see CLAUDE.md results tone + brand skill):
 * - Only domains that actually produced a score are eligible for either
 *   slot. An insufficient_data domain is a missing measurement, not a
 *   weakness — it can never be the "growth area" (or the strength).
 * - With fewer than 2 scored domains there is nothing to compare, so
 *   neither slot is filled — the screen says so instead.
 * - If every scored domain landed on the same score, naming one of them a
 *   "growth area" would be a manufactured deficit — report a balanced
 *   profile instead.
 *
 * Kept outside src/lib/scoring/ on purpose: this is presentation logic over
 * an already-computed BrainScoreResult, not part of the verified engine.
 */

import { DOMAIN_KEYS, type DomainKey, type DomainScores } from "@/lib/scoring/types";

export type ScoredDomain = { key: DomainKey; score: number };

export type Insights =
  | { kind: "pair"; strength: ScoredDomain; growth: ScoredDomain }
  | { kind: "balanced"; score: number; scoredCount: number }
  | { kind: "not_enough"; scoredCount: number };

export function pickInsights(domains: DomainScores): Insights {
  const scored: ScoredDomain[] = [];
  // Iterating DOMAIN_KEYS (not Object.keys) makes tie-breaking deterministic:
  // among tied domains, the first in canonical order wins its slot.
  for (const key of DOMAIN_KEYS) {
    const domain = domains[key];
    if (domain.status === "scored") scored.push({ key, score: domain.score });
  }

  if (scored.length < 2) {
    return { kind: "not_enough", scoredCount: scored.length };
  }

  let strength = scored[0];
  let growth = scored[0];
  for (const d of scored) {
    if (d.score > strength.score) strength = d;
    if (d.score < growth.score) growth = d;
  }

  if (strength.score === growth.score) {
    return { kind: "balanced", score: strength.score, scoredCount: scored.length };
  }

  return { kind: "pair", strength, growth };
}
