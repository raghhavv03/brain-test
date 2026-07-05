import { supabase } from "@/lib/supabase/client";

const DEFAULT_SEGMENT = "performance_seeker";

let sessionPromise: Promise<string> | null = null;

/** Signs the visitor in anonymously (once) and ensures their sessions row exists. */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = createSession();
  }
  return sessionPromise;
}

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

  return userId;
}
