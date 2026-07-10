-- Phase 3.3: one results row per run.
-- Run this in the Supabase SQL editor before testing the results screen.
--
-- saveResult is called from the results screen, which can mount more than
-- once for the same completed run (React StrictMode, remounts). The client
-- uses an upsert with ON CONFLICT DO NOTHING on run_id, which requires this
-- unique constraint. Postgres treats NULLs as distinct, so legacy rows and
-- any future null-run_id rows are unaffected.
--
-- If this fails with a duplicate-key error, the table still holds old dev
-- verification rows sharing a run_id — clear them first (see §9b test-data
-- hygiene in docs/project-reference.md).

alter table public.results
  add constraint results_run_id_key unique (run_id);
