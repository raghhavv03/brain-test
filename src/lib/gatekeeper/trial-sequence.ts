/**
 * Gatekeeper skeleton: fixed 32 go / 8 no-go (80/20 of 40), shuffled once per
 * run. A fixed-composition shuffle guarantees the ratio; a per-trial coin
 * flip would not.
 */

export type StimulusType = "go" | "no-go";

export const GO_COUNT = 32;
export const NO_GO_COUNT = 8;
export const TOTAL_TRIALS = GO_COUNT + NO_GO_COUNT;

/**
 * Defaults are the fixed scored skeleton (32/8). The parameters exist only
 * for the shorter practice round (same 80/20 ratio, same fixed-count
 * shuffle) — never pass other values for a scored run.
 */
export function generateTrialSequence(
  goCount: number = GO_COUNT,
  noGoCount: number = NO_GO_COUNT
): StimulusType[] {
  const sequence: StimulusType[] = [
    ...Array<StimulusType>(goCount).fill("go"),
    ...Array<StimulusType>(noGoCount).fill("no-go"),
  ];

  for (let i = sequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
  }

  return sequence;
}
