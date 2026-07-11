-- Phase 3.3 (b): one lead per session, not per run.
-- Run this in the Supabase SQL editor before testing the email-capture form.
--
-- leads has no run_id column (§9) — email capture is a session-level action,
-- not tied to one sequence attempt. A retake in the same browser that
-- already submitted an email should be recognized as already-submitted, not
-- create a second marketing contact. The insert path (src/lib/supabase/leads.ts)
-- is a plain insert (not upsert) that catches 23505 explicitly, matching the
-- existing ensureSession() convention in src/lib/supabase/session.ts — this
-- constraint is what makes that 23505 path reachable.
--
-- Deliberately NOT unique on email: two different anonymous sessions typing
-- the same email address must not collide. A uniqueness violation on email
-- would leak the fact that "this email already exists" across sessions,
-- which conflicts with this project's strict per-session RLS isolation (§9).

alter table public.leads
  add constraint leads_session_id_key unique (session_id);
