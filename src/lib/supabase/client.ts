import { createClient } from "@supabase/supabase-js";

// Explicit auth options (July 2026 production incident: the implicit
// defaults left session persistence unpinned, which is suspected to have
// contributed to an anonymous-JWT/cached-identity desync on iOS Safari after
// backgrounding — see src/lib/supabase/session.ts for the self-heal/halt
// logic this pairs with).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // anonymous auth only — no OAuth/magic-link redirects to parse
      flowType: "pkce",
      storageKey: "btp-auth",
    },
  }
);
