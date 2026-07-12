import { supabase } from "@/lib/supabase/client";

const DEFAULT_SEGMENT = "performance_seeker";

let sessionPromise: Promise<string> | null = null;
let currentUserId: string | null = null;

// True from the moment a /test run starts (Begin pressed, run_id minted)
// until it ends (results reached, or the run is abandoned/restarted) — set
// by the sequence wrapper via setRunActive(). Once any trial has saved under
// a (session_id, run_id) pair, session_id must never change again for that
// run: fetchRunTrials's exact-pair filter (src/lib/scoring/session.ts) has
// no way to recover a run split across two identities. So a desync detected
// while a run is active must NOT be silently healed here — see the
// onAuthStateChange handler below, and the halt-and-restart screen in
// src/app/test/page.tsx which is the only sanctioned recovery mid-run.
let runActive = false;

export function setRunActive(active: boolean): void {
  runActive = active;
}

// Forces the next ensureSession() call to genuinely re-derive an identity
// instead of returning a cached one. Needed specifically because the
// onAuthStateChange handler below deliberately drops desync events while a
// run is active — that dropped event never gets "replayed", so simply
// flipping runActive back to false on restart is not enough to recover: the
// stale sessionPromise is still sitting there. Call this before re-checking
// the session on the halt-and-restart path (src/app/test/page.tsx).
export function resetSession(): void {
  sessionPromise = null;
  currentUserId = null;
}

/** Signs the visitor in anonymously (once) and ensures their sessions row exists. */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    // On failure (e.g. a network error during signInAnonymously — no
    // auth-state-change event fires for that, so the listener below never
    // sees it), clear the memoized promise so the NEXT call genuinely
    // retries instead of forever returning the same rejected promise. The
    // rejection itself still propagates to this call's caller.
    sessionPromise = createSession().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

// Fires on every Supabase auth event. TOKEN_REFRESHED keeps the same user id
// and is ignored. SIGNED_OUT or a changed user id means the persisted JWT
// and our cached identity have desynced (the July 2026 production incident:
// observed on iOS Safari after the tab was backgrounded/reloaded mid-flow).
// Pre-run (runActive false), this is safe to self-heal — nothing has saved
// yet under any run_id, so invalidating the memoized promise just makes the
// next ensureSession() call re-derive a fresh, verified identity. Mid-run,
// healing here would mint a new session_id while trials already exist under
// the old one for the active run_id, silently splitting that run across two
// identities (see the file-level comment on runActive) — so this
// deliberately does nothing while a run is active, leaving the stale cached
// id in place so the next saveTrial fails fast and visibly via RLS rejection
// rather than switching identity underneath the run.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "TOKEN_REFRESHED") return;

  // No identity established yet by our own createSession() — an event
  // firing before that completes (e.g. the initial SIGNED_IN from the very
  // first getSession()/signInAnonymously()) isn't a desync to react to, just
  // startup noise. Reacting here would null a sessionPromise that's still
  // in-flight, forcing a redundant (though harmless/idempotent) re-run.
  if (currentUserId === null) return;

  const newUserId = session?.user?.id ?? null;
  if (newUserId === currentUserId) return;

  if (runActive) return;

  sessionPromise = null;
});

async function createSession(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let userId = session?.user?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    userId = data.user?.id;
  }

  if (!userId) {
    throw new Error("Could not establish an anonymous session.");
  }

  const { error: insertError } = await supabase.from("sessions").insert({
    id: userId,
    segment: DEFAULT_SEGMENT,
    user_agent: navigator.userAgent,
  });

  // 23505 = unique_violation — this visitor already has a sessions row, which is fine.
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  currentUserId = userId;
  return userId;
}
