/**
 * Shared props for the five game components. Each game's scored skeleton is
 * untouched by these: "practice" only selects a shorter trial plan (defined
 * per game) run through the exact same trial loop, timing code, and
 * classification logic, saved with is_practice = true.
 */
export type GameMode = "practice" | "scored";

export type GameProps = {
  /** Default "scored". "practice" = short unscored warm-up. */
  mode?: GameMode;
  /** Sequence run this play belongs to; null = standalone/direct play. */
  runId?: string | null;
  /**
   * Provided by the sequence wrapper: the done screen shows a Continue
   * button calling this instead of the standalone "Run again" button.
   */
  onComplete?: () => void;
};
