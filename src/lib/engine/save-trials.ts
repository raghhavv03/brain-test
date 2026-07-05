import { supabase } from "@/lib/supabase/client";

export type TrialRow = {
  session_id: string;
  game: string;
  trial_index: number;
  stimulus: Record<string, unknown>;
  response: Record<string, unknown> | null;
  rt_ms: number | null;
  correct: boolean;
  discarded: boolean;
};

export async function saveTrial(row: TrialRow): Promise<void> {
  const { error } = await supabase.from("trials").insert(row);
  if (error) throw error;
}
