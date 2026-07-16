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

// 1 initial attempt + 2 retries, 400ms then 1000ms backoff (July 2026
// production incident's follow-up: a single dropped insert was costing a
// whole 10-minute run). Only applies to transient-shaped failures — see
// isTransient below.
const RETRY_DELAYS_MS = [400, 1000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Classifies by HTTP status, not error.code — confirmed against the
// installed @supabase/postgrest-js (node_modules/@supabase/postgrest-js/
// dist/index.mjs): a genuine network-level failure (fetch never got a
// response at all) is always wrapped with status: 0, explicitly, in the
// library's own fetch-rejection handler. status: 503 covers PostgREST/DB-
// layer transient unavailability (e.g. PGRST000/001/002 — can't reach the
// DB, schema-cache reload), which *does* carry a structured error.code and
// was wrongly classified as a permanent rejection by an earlier version of
// this check that keyed off code presence alone. Any other status (401,
// 403 — including RLS's 42501, 400, etc.) is a real rejection: retrying a
// genuinely mismatched identity is pointless, since it fails identically
// every time, so those fail fast instead of waiting through backoff.
function isTransient(status: number): boolean {
  return status === 0 || status === 503;
}

// Retrying a POST risks a duplicate row if the original insert actually
// succeeded server-side but the client never saw the response (network
// drop after commit, not before). Two layers of defense: an existence
// check before each retry (best-effort — see the 23505 fallback below for
// what happens if this check itself can't reach the server), and a unique
// index (supabase/migrations/20260714_trials_unique.sql) on (session_id,
// run_id, game, trial_index, is_practice) as the actual guarantee, so a
// retry that slips past this check still can't create a duplicate row —
// it gets 23505 instead, treated as success below.
async function rowAlreadySaved(row: TrialRow): Promise<boolean> {
  let query = supabase
    .from("trials")
    .select("id", { count: "exact", head: true })
    .eq("session_id", row.session_id)
    .eq("game", row.game)
    .eq("trial_index", row.trial_index)
    .eq("is_practice", row.is_practice);

  // .eq("run_id", null) does not match SQL NULL — PostgREST needs .is()
  // for that. Standalone/direct plays always have run_id: null.
  query = row.run_id === null ? query.is("run_id", null) : query.eq("run_id", row.run_id);

  const { count, error } = await query;
  if (error) return false; // can't confirm either way — fall through to a retry attempt
  return (count ?? 0) > 0;
}

export async function saveTrial(row: TrialRow): Promise<void> {
  const { error: firstError, status: firstStatus } = await supabase
    .from("trials")
    .insert(row);
  if (!firstError) return;
  if (firstError.code === "23505") return; // already saved — see the migration note above

  if (!isTransient(firstStatus)) throw firstError;

  let lastError = firstError;
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await rowAlreadySaved(row)) return;

    const { error, status } = await supabase.from("trials").insert(row);
    if (!error) return;
    if (error.code === "23505") return; // the unique index caught a duplicate — already saved
    // A desync could newly appear mid-retry-sequence too — same fail-fast
    // logic applies the moment it does.
    if (!isTransient(status)) throw error;
    lastError = error;
  }

  throw lastError;
}
