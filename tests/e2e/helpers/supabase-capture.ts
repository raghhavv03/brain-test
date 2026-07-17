import type { Page } from "@playwright/test";

/**
 * Watches outgoing trials-table inserts during a run and extracts what's
 * needed to read them back afterward, respecting RLS: the anon session JWT
 * (captured off the real Authorization header the app sent, never a
 * service-role key) plus the session_id/run_id every insert carried in its
 * body. No test-only hook added to app code — this only observes real
 * network traffic the app already produces.
 */
export type CapturedRunIdentity = {
  sessionId: string;
  runId: string;
  jwt: string;
};

export function watchTrialInserts(page: Page): {
  identity: () => CapturedRunIdentity | null;
} {
  let identity: CapturedRunIdentity | null = null;

  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (!/\/rest\/v1\/trials(\?|$)/.test(request.url())) return;

    const body = request.postDataJSON() as {
      session_id?: string;
      run_id?: string | null;
    } | null;
    if (!body?.session_id || !body.run_id) return;

    const auth = request.headers()["authorization"];
    const jwt = auth?.replace(/^Bearer\s+/i, "");
    if (!jwt) return;

    identity = { sessionId: body.session_id, runId: body.run_id, jwt };
  });

  return { identity: () => identity };
}

/**
 * Authenticated read against `trials` for one game, using the captured
 * session JWT (not the service-role key) — subject to RLS like any real
 * client read. Game-agnostic: pass whichever game's rows you want.
 *
 * `expectedCount`, if given, polls briefly instead of reading once — the
 * calling spec already waits for the game's own done-screen (which is
 * itself downstream of every saveTrial() call resolving), so this isn't
 * covering for that; it's a small guard against ordinary read-replica/
 * network-timing lag between the last insert response and this read.
 * Whatever's read back after the timeout is returned as-is either way, so a
 * genuine short count still fails the spec's own assertions with a clear
 * row-count mismatch rather than being masked here.
 */
export async function fetchTrialRows(
  page: Page,
  identity: CapturedRunIdentity,
  game: string,
  expectedCount?: number
): Promise<unknown[]> {
  const url =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trials` +
    `?session_id=eq.${identity.sessionId}` +
    `&run_id=eq.${identity.runId}` +
    `&game=eq.${game}` +
    `&order=is_practice.desc,trial_index.asc`;

  const headers = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${identity.jwt}`,
  };

  const maxAttempts = expectedCount !== undefined ? 5 : 1;
  let rows: unknown[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await page.request.get(url, { headers });
    if (!response.ok()) {
      throw new Error(
        `Trials read failed: ${response.status()} ${await response.text()}`
      );
    }
    rows = await response.json();

    if (expectedCount === undefined || rows.length === expectedCount) break;
    if (attempt < maxAttempts) await page.waitForTimeout(300);
  }

  return rows;
}

/**
 * Authenticated read against `results` for one run. Unlike trials, the
 * results row is written *after* the results screen's headline already
 * renders (results-screen.tsx calls setState({status:"ready"}) before
 * awaiting saveResult()) — so there's no "done screen implies saved" sync
 * point here, and polling for `expectedCount` matters more than it does for
 * `fetchTrialRows`.
 */
export async function fetchResultsRows(
  page: Page,
  identity: CapturedRunIdentity,
  expectedCount?: number
): Promise<unknown[]> {
  const url =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/results` +
    `?session_id=eq.${identity.sessionId}` +
    `&run_id=eq.${identity.runId}`;

  const headers = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${identity.jwt}`,
  };

  const maxAttempts = expectedCount !== undefined ? 10 : 1;
  let rows: unknown[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await page.request.get(url, { headers });
    if (!response.ok()) {
      throw new Error(
        `Results read failed: ${response.status()} ${await response.text()}`
      );
    }
    rows = await response.json();

    if (expectedCount === undefined || rows.length === expectedCount) break;
    if (attempt < maxAttempts) await page.waitForTimeout(300);
  }

  return rows;
}
