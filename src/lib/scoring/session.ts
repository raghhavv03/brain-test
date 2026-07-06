/**
 * Supabase I/O for the scoring engine: fetch a session's raw trials, save the
 * computed result to `results`. All scoring math stays in the pure modules
 * (domains.ts / brain-score.ts) so it is unit-testable and re-runnable.
 */

import { supabase } from "@/lib/supabase/client";
import type { BrainScoreResult, StoredTrial } from "./types";

export async function fetchSessionTrials(
  sessionId: string
): Promise<StoredTrial[]> {
  const { data, error } = await supabase
    .from("trials")
    .select("game, trial_index, stimulus, response, rt_ms, correct, discarded")
    .eq("session_id", sessionId)
    .order("trial_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoredTrial[];
}

export async function saveResult(
  sessionId: string,
  result: BrainScoreResult
): Promise<void> {
  const { error } = await supabase.from("results").insert({
    session_id: sessionId,
    // Full domain breakdown, including insufficient_data statuses and
    // reasons — the results screen reads these to show the "not enough
    // clean data" state instead of silently dropping a domain.
    sub_scores: result.domains,
    headline_score:
      result.headline.status === "scored" ? result.headline.score : null,
    band_label:
      result.headline.status === "scored" ? result.headline.band : null,
  });
  if (error) throw error;
}
