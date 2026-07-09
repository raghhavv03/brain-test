/**
 * Echo skeleton: 24 letters, exactly 7 true 2-back targets (~29%, "roughly
 * 30%"), positions 1–2 excluded (no 2-back reference exists yet). Target
 * positions are forced to match 2-back; every other position is drawn
 * excluding the 2-back letter, so it cannot accidentally match by chance —
 * without that exclusion the true target rate would drift above the
 * intended ~30%.
 */

export const LETTER_POOL = ["B", "F", "H", "K", "M", "Q", "R", "X"] as const;
export type Letter = (typeof LETTER_POOL)[number];

export const TOTAL_ITEMS = 24;
export const TARGET_COUNT = 7;

function randomLetter(exclude?: Letter): Letter {
  const pool = exclude
    ? LETTER_POOL.filter((letter) => letter !== exclude)
    : LETTER_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Defaults are the fixed scored skeleton (24 items / 7 targets). The
 * parameters exist only for the shorter practice round, which uses the same
 * forced-target construction — never pass other values for a scored run.
 */
export function generateItemSequence(
  totalItems: number = TOTAL_ITEMS,
  targetCount: number = TARGET_COUNT
): Letter[] {
  const sequence: Letter[] = new Array(totalItems);
  sequence[0] = randomLetter();
  sequence[1] = randomLetter();

  // Eligible target positions: index 2..totalItems-1 (items 3 onward).
  const eligible = Array.from({ length: totalItems - 2 }, (_, k) => k + 2);
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const targetPositions = new Set(eligible.slice(0, targetCount));

  for (let i = 2; i < totalItems; i++) {
    sequence[i] = targetPositions.has(i)
      ? sequence[i - 2]
      : randomLetter(sequence[i - 2]);
  }

  return sequence;
}

/** Ground truth, recomputed from the actual sequence — never trust the
 * generator's designated-position list at classification time. */
export function isTarget(sequence: Letter[], index: number): boolean {
  return index >= 2 && sequence[index] === sequence[index - 2];
}
