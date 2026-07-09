-- Phase 3.1: run identity + practice flag.
-- Run this in the Supabase SQL editor before testing the sequence wrapper.
--
-- run_id: one full "Cognitive Performance Lab" sequence attempt, minted
-- client-side at sequence start. session_id stays = the visitor (anonymous
-- auth identity); run_id distinguishes attempts, so a retake in the same
-- browser can never mix trials with an earlier attempt. NULL run_id =
-- standalone/direct play (dev testing a game via its own URL) — never scored.
--
-- is_practice: short unscored warm-up round before each scored game. Raw
-- rows are still always saved (science rule); the scoring fetch excludes
-- them.

alter table public.trials
  add column if not exists run_id uuid,
  add column if not exists is_practice boolean not null default false;

alter table public.results
  add column if not exists run_id uuid;

comment on column public.trials.run_id is
  'Full-sequence attempt this trial belongs to; null = standalone play, never scored.';
comment on column public.trials.is_practice is
  'Unscored practice trial; excluded by the scoring fetch layer.';
comment on column public.results.run_id is
  'The run this result was computed from.';

create index if not exists trials_session_run_idx
  on public.trials (session_id, run_id);
