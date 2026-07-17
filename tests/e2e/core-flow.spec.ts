import { expect, test, type Page } from "@playwright/test";
import { runTrigger } from "./helpers/trigger";
import { runGatekeeper } from "./helpers/gatekeeper";
import { runEcho } from "./helpers/echo";
import { runCircuit } from "./helpers/circuit";
import { runLockon } from "./helpers/lockon";
import {
  fetchResultsRows,
  fetchTrialRows,
  watchTrialInserts,
  type CapturedRunIdentity,
} from "./helpers/supabase-capture";

type TrialRow<S = Record<string, unknown>> = {
  id: string;
  session_id: string;
  run_id: string;
  game: string;
  trial_index: number;
  stimulus: S;
  rt_ms: number | null;
  correct: boolean;
  discarded: boolean;
  is_practice: boolean;
};

type GatekeeperStimulus = { type: "go" | "no-go" };
type EchoStimulus = {
  letter: string;
  is_target: boolean;
  classification: "hit" | "miss" | "false_alarm" | "correct_rejection";
};

/** Shared shape every game's rows must satisfy — same checks Trigger's spec used originally. */
function assertCommonShape(
  rows: TrialRow[],
  identity: CapturedRunIdentity,
  practiceCount: number,
  scoredCount: number
): { practiceRows: TrialRow[]; scoredRows: TrialRow[] } {
  const practiceRows = rows.filter((r) => r.is_practice);
  const scoredRows = rows.filter((r) => !r.is_practice);

  expect(practiceRows).toHaveLength(practiceCount);
  expect(scoredRows).toHaveLength(scoredCount);

  for (const row of rows) {
    expect(row.session_id).toBe(identity.sessionId);
    expect(row.run_id).toBe(identity.runId);
    expect(row.discarded).toBe(false);
  }
  for (const row of scoredRows) {
    expect(row.is_practice).toBe(false);
  }

  return { practiceRows, scoredRows };
}

function dump(label: string, identity: CapturedRunIdentity, rows: unknown[]) {
  console.log(
    `\n=== ${label} — run_id=${identity.runId} session_id=${identity.sessionId} ===\n` +
      JSON.stringify(rows, null, 2)
  );
}

async function continueToNextGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("core flow — all 5 games practice + scored, then results", async ({
  page,
}) => {
  const capture = watchTrialInserts(page);

  await page.goto("/");
  // Two "Take the Brain Test" CTAs on Home (hero + lower); Base UI renders
  // these as role="button" (nativeButton={false}), not role="link" — a
  // link-role query would silently match the footer's unrelated nav link
  // instead (§8b/§11).
  await page
    .getByRole("button", { name: "Take the Brain Test" })
    .first()
    .click();

  await page.waitForURL("**/test");

  await page
    .getByRole("button", { name: "Begin" })
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("button", { name: "Begin" }).click();

  // --- Trigger ---
  const triggerLog = await runTrigger(page);
  const identity = capture.identity();
  expect(
    identity,
    "captured session_id/run_id/JWT from a trials insert"
  ).toBeTruthy();

  const triggerRows = (await fetchTrialRows(
    page,
    identity!,
    "trigger",
    28
  )) as TrialRow[];
  const { scoredRows: triggerScored } = assertCommonShape(
    triggerRows,
    identity!,
    3,
    25
  );

  const triggerPressed = new Set(
    triggerLog.filter((a) => a.phase === "scored").map((a) => a.trialIndex)
  );
  expect(triggerPressed.size).toBe(25);
  for (const row of triggerScored) {
    expect(triggerPressed.has(row.trial_index)).toBe(true);
    expect(row.correct).toBe(true);
    expect(row.rt_ms).not.toBeNull();
    expect(row.rt_ms as number).toBeGreaterThan(0);
    expect(row.rt_ms as number).toBeLessThan(2500);
  }
  dump("Trigger", identity!, triggerRows);

  // --- Gatekeeper ---
  await continueToNextGame(page);
  const gatekeeperLog = await runGatekeeper(page);

  const gatekeeperRows = (await fetchTrialRows(
    page,
    identity!,
    "gatekeeper",
    50
  )) as TrialRow<GatekeeperStimulus>[];
  const { scoredRows: gatekeeperScored } = assertCommonShape(
    gatekeeperRows,
    identity!,
    10,
    40
  );

  const goRows = gatekeeperScored.filter((r) => r.stimulus.type === "go");
  const noGoRows = gatekeeperScored.filter((r) => r.stimulus.type === "no-go");
  expect(goRows).toHaveLength(32);
  expect(noGoRows).toHaveLength(8);

  // Clean run: every go was pressed, every no-go withheld — both count as
  // "correct" by the game's own classification (go: responded; no-go:
  // withheld), diffed against the helper's action log.
  const pressedIndexes = new Set(
    gatekeeperLog
      .filter((a) => a.phase === "scored" && a.actionTaken === "pressed")
      .map((a) => a.trialIndex)
  );
  const withheldIndexes = new Set(
    gatekeeperLog
      .filter((a) => a.phase === "scored" && a.actionTaken === "withheld")
      .map((a) => a.trialIndex)
  );
  expect(pressedIndexes.size).toBe(32);
  expect(withheldIndexes.size).toBe(8);

  for (const row of goRows) {
    expect(pressedIndexes.has(row.trial_index)).toBe(true);
    expect(row.correct).toBe(true);
    expect(row.rt_ms).not.toBeNull();
    expect(row.rt_ms as number).toBeGreaterThan(0);
    expect(row.rt_ms as number).toBeLessThanOrEqual(600);
  }
  for (const row of noGoRows) {
    expect(withheldIndexes.has(row.trial_index)).toBe(true);
    expect(row.correct).toBe(true);
    expect(row.rt_ms).toBeNull(); // held — no response captured
  }
  dump("Gatekeeper", identity!, gatekeeperRows);

  // --- Echo ---
  await continueToNextGame(page);
  const echoLog = await runEcho(page);

  const echoRows = (await fetchTrialRows(
    page,
    identity!,
    "echo",
    32
  )) as TrialRow<EchoStimulus>[];
  const { scoredRows: echoScored } = assertCommonShape(
    echoRows,
    identity!,
    8,
    24
  );

  const hits = echoScored.filter((r) => r.stimulus.classification === "hit");
  const correctRejections = echoScored.filter(
    (r) => r.stimulus.classification === "correct_rejection"
  );
  const falseAlarms = echoScored.filter(
    (r) => r.stimulus.classification === "false_alarm"
  );
  const misses = echoScored.filter((r) => r.stimulus.classification === "miss");

  // The helper computes its own 2-back ground truth from what it reads off
  // the DOM (not trusting the generator, same discipline as isTarget() in
  // src/lib/echo/item-sequence.ts) and always acts on it cleanly, so this
  // should land exactly on the fixed skeleton's 7 forced targets — zero
  // false alarms or misses.
  expect(hits).toHaveLength(7);
  expect(correctRejections).toHaveLength(17);
  expect(falseAlarms).toHaveLength(0);
  expect(misses).toHaveLength(0);

  const echoPressed = new Set(
    echoLog
      .filter((a) => a.phase === "scored" && a.actionTaken === "pressed")
      .map((a) => a.itemIndex)
  );
  for (const row of hits) {
    expect(echoPressed.has(row.trial_index)).toBe(true);
    expect(row.correct).toBe(true);
    expect(row.rt_ms).not.toBeNull();
    expect(row.rt_ms as number).toBeGreaterThan(0);
    expect(row.rt_ms as number).toBeLessThanOrEqual(2500);
  }
  for (const row of correctRejections) {
    expect(echoPressed.has(row.trial_index)).toBe(false);
    expect(row.correct).toBe(true);
    expect(row.rt_ms).toBeNull();
  }
  dump("Echo", identity!, echoRows);

  // --- Circuit ---
  await continueToNextGame(page);
  await runCircuit(page);

  const circuitRows = (await fetchTrialRows(
    page,
    identity!,
    "circuit",
    22 // 6 practice + 16 scored
  )) as TrialRow<{ expected: string; sequence_position: number }>[];
  const { scoredRows: circuitScored } = assertCommonShape(
    circuitRows,
    identity!,
    6,
    16
  );

  for (const row of circuitScored) {
    expect(row.correct).toBe(true);
  }
  // elapsed_since_first_tap_ms lives in `response`, not a top-level column —
  // widen the row type locally for this one check.
  const circuitElapsed = (
    circuitScored as unknown as {
      trial_index: number;
      response: { elapsed_since_first_tap_ms: number };
    }[]
  )
    .slice()
    .sort((a, b) => a.trial_index - b.trial_index)
    .map((r) => r.response.elapsed_since_first_tap_ms);
  for (let i = 1; i < circuitElapsed.length; i++) {
    expect(circuitElapsed[i]).toBeGreaterThan(circuitElapsed[i - 1]);
  }
  dump("Circuit", identity!, circuitRows);

  // --- Lock-On ---
  await continueToNextGame(page);
  await runLockon(page);

  const lockonRows = (await fetchTrialRows(
    page,
    identity!,
    "lockon",
    2 // 1 practice round + 1 scored round (deliberate miss ends escalation immediately)
  )) as TrialRow<{ k: number }>[];
  const { scoredRows: lockonScored } = assertCommonShape(
    lockonRows,
    identity!,
    1,
    1
  );

  expect(lockonScored[0].correct).toBe(false);
  expect(lockonScored[0].stimulus.k).toBe(3);
  dump("Lock-On", identity!, lockonRows);

  // --- Results ---
  await continueToNextGame(page);
  await page
    .getByRole("heading", { name: "Your session results" })
    .waitFor({ state: "visible", timeout: 15_000 });

  type ResultsRow = {
    id: string;
    session_id: string;
    run_id: string;
    sub_scores: Record<
      string,
      { status: "scored" | "insufficient_data"; score?: number; reason?: string }
    >;
    headline_score: number | null;
    band_label: string | null;
  };

  const DOMAIN_KEYS = [
    "speed",
    "impulse_control",
    "working_memory",
    "flexibility",
    "divided_attention",
  ];

  const firstResults = (await fetchResultsRows(
    page,
    identity!,
    1
  )) as ResultsRow[];
  expect(firstResults).toHaveLength(1);
  expect(firstResults[0].session_id).toBe(identity!.sessionId);
  expect(firstResults[0].run_id).toBe(identity!.runId);
  for (const key of DOMAIN_KEYS) {
    expect(firstResults[0].sub_scores[key]?.status).toBe("scored");
  }
  expect(firstResults[0].headline_score).not.toBeNull();
  dump("Results (first load)", identity!, firstResults);

  // A literal browser reload does NOT return here: src/app/test/page.tsx's
  // step/runId are plain useState, not URL-backed, so page.reload() drops
  // back to the intro screen ("a page refresh mid-run loses the in-memory
  // flow state and restarts as a new run" — confirmed live, this exact
  // reload attempt landed on the "Begin" intro, not results). There is no
  // route the UI itself can reload onto for an already-finished run's
  // results screen.
  //
  // Same intent, real code path instead: results-screen.tsx's saveResult()
  // is `supabase.from("results").upsert(row, { onConflict: "run_id",
  // ignoreDuplicates: true })` — issuing that identical upsert a second
  // time, with the same captured session JWT, exercises the exact DB
  // constraint the idempotency guarantee actually rests on (the code
  // comment: "results.run_id is unique... needs no UPDATE policy under
  // RLS"), independent of whether it's triggered by a React remount or a
  // second real call — same server-side operation either way.
  const duplicateUpsert = await page.request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/results?on_conflict=run_id`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${identity!.jwt}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      data: {
        session_id: firstResults[0].session_id,
        run_id: firstResults[0].run_id,
        sub_scores: firstResults[0].sub_scores,
        headline_score: firstResults[0].headline_score,
        band_label: firstResults[0].band_label,
      },
    }
  );
  expect(duplicateUpsert.ok()).toBe(true);

  const secondResults = (await fetchResultsRows(
    page,
    identity!,
    1
  )) as ResultsRow[];
  expect(secondResults).toHaveLength(1);
  expect(secondResults[0].id).toBe(firstResults[0].id);
  dump("Results (after duplicate upsert)", identity!, secondResults);
});
