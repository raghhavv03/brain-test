import { supabase } from "@/lib/supabase/client";

export type TrialRow = {
  session_id: string;
  // The full-sequence run this trial belongs to; null = standalone/direct
  // play (a game opened via its own URL), which is never scored.
  run_id: string | null;
  game: string;
  trial_index: number;
  stimulus: Record<string, unknown>;
  response: Record<string, unknown> | null;
  rt_ms: number | null;
  correct: boolean;
  discarded: boolean;
  // Practice trials are saved like everything else (raw data is always
  // kept) but excluded from scoring by the fetch layer.
  is_practice: boolean;
};

export async function saveTrial(row: TrialRow): Promise<void> {
  const { error } = await supabase.from("trials").insert(row);
  if (error) throw error;
}
