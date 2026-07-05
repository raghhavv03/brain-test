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

export function generateItemSequence(): Letter[] {
  const sequence: Letter[] = new Array(TOTAL_ITEMS);
  sequence[0] = randomLetter();
  sequence[1] = randomLetter();

  // Eligible target positions: index 2..TOTAL_ITEMS-1 (items 3..24).
  const eligible = Array.from({ length: TOTAL_ITEMS - 2 }, (_, k) => k + 2);
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const targetPositions = new Set(eligible.slice(0, TARGET_COUNT));

  for (let i = 2; i < TOTAL_ITEMS; i++) {
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
