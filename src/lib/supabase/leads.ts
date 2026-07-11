import { supabase } from "@/lib/supabase/client";

export type SaveLeadResult = "created" | "duplicate";

/**
 * One lead per session, not per run — leads has no run_id column (§9), and a
 * retake in the same browser that already submitted an email shouldn't
 * create a second marketing contact. Enforced by a unique constraint on
 * leads.session_id; a plain insert (not upsert) so a repeat submission
 * surfaces as an explicit 23505, matching the ensureSession() convention in
 * src/lib/supabase/session.ts.
 */
export async function saveLead(
  sessionId: string,
  email: string
): Promise<SaveLeadResult> {
  const { error } = await supabase
    .from("leads")
    .insert({ session_id: sessionId, email });

  if (!error) return "created";
  if (error.code === "23505") return "duplicate";
  throw error;
}
