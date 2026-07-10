/**
 * Supabase I/O for the scoring engine: fetch the raw trials of one run, save
 * the computed result to `results`. All scoring math stays in the pure
 * modules (domains.ts / brain-score.ts) so it is unit-testable and
 * re-runnable.
 */

import { supabase } from "@/lib/supabase/client";
import type { BrainScoreResult, StoredTrial } from "./types";

/**
 * Scored trials of one full-sequence run. Filtering by run_id (not just
 * session_id) is what keeps a retake in the same browser from mixing trials
 * across attempts; practice trials and standalone plays (run_id null) never
 * appear here.
 */
export async function fetchRunTrials(
  sessionId: string,
  runId: string
): Promise<StoredTrial[]> {
  const { data, error } = await supabase
    .from("trials")
    .select("game, trial_index, stimulus, response, rt_ms, correct, discarded")
    .eq("session_id", sessionId)
    .eq("run_id", runId)
    .eq("is_practice", false)
    .order("trial_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoredTrial[];
}

export async function saveResult(
  sessionId: string,
  runId: string,
  result: BrainScoreResult
): Promise<void> {
  // Idempotent per run: results.run_id is unique, and a re-save of the same
  // run recomputes an identical result (pure function over the same trials),
  // so ON CONFLICT DO NOTHING is correct — it also needs no UPDATE policy
  // under RLS. Guards against remounts of the results screen re-inserting.
  const { error } = await supabase.from("results").upsert(
    {
      session_id: sessionId,
      run_id: runId,
      // Full domain breakdown, including insufficient_data statuses and
      // reasons — the results screen reads these to show the "not enough
      // clean data" state instead of silently dropping a domain.
      sub_scores: result.domains,
      headline_score:
        result.headline.status === "scored" ? result.headline.score : null,
      band_label:
        result.headline.status === "scored" ? result.headline.band : null,
    },
    { onConflict: "run_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}
