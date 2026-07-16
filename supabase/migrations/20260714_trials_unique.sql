-- Follow-up to the July 2026 session-integrity incident (docs/project-reference.md §9e).
-- Run this in the Supabase SQL editor before deploying the retry-then-halt fix.
--
-- saveTrial() (src/lib/engine/save-trials.ts) retries a failed insert on
-- transient network/server errors. Without this constraint, a retry after a
-- "the original insert actually succeeded but the response was lost"
-- race could create a duplicate trial row for the same (session_id, run_id,
-- game, trial_index, is_practice) — silent, wrong-but-valid-looking scoring
-- corruption (e.g. Circuit's completion check assumes exactly one row per
-- tap index), which is worse than the honest halt this whole system exists
-- to guarantee instead of.
--
-- Partial (excludes run_id IS NULL): standalone/direct game plays (e.g.
-- /circuit opened directly) always save with run_id: null and are never
-- scored (fetchRunTrials filters them out) — different independent plays
-- of the same game by the same session can legitimately share trial_index
-- values across visits, and must not collide here.
--
-- The insert path now catches 23505 on retry and treats it as success
-- (row already exists — no re-insert needed), matching the existing
-- leads.ts / session.ts convention for this project.

create unique index trials_unique_scored_trial
  on public.trials (session_id, run_id, game, trial_index, is_practice)
  where run_id is not null;
