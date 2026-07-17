import type { Page } from "@playwright/test";

/**
 * Drives Trigger's practice + scored rounds end to end. Always responds to
 * the stimulus promptly with Space (the only key the game accepts —
 * src/lib/engine/measurement.ts) — no deliberate misses/false-starts here,
 * this is the pattern-setter "clean run" case. Returns a log of what it
 * actually did so the spec can diff intent against saved data.
 */
export type TriggerActionLogEntry = {
  phase: "practice" | "scored";
  trialIndex: number;
  stimulusVisibleAt: number;
  keyPressedAt: number;
};

const PRACTICE_TRIAL_COUNT = 3;
const SCORED_TRIAL_COUNT = 25;
const STIMULUS_TIMEOUT_MS = 5_000; // generous vs. the game's own 1-3s foreperiod

async function playRound(
  page: Page,
  phase: "practice" | "scored",
  trialCount: number,
  log: TriggerActionLogEntry[]
): Promise<void> {
  const target = page.locator("[data-target]");

  for (let i = 0; i < trialCount; i++) {
    // The element exists throughout; only its inline visibility style flips.
    // Wait for the visible state specifically, not just DOM presence.
    await target.evaluate(
      (el, timeoutMs) =>
        new Promise<void>((resolve, reject) => {
          if (el.style.visibility === "visible") return resolve();
          const start = Date.now();
          const poll = () => {
            if (el.style.visibility === "visible") return resolve();
            if (Date.now() - start > timeoutMs)
              return reject(new Error("Stimulus never became visible"));
            requestAnimationFrame(poll);
          };
          requestAnimationFrame(poll);
        }),
      STIMULUS_TIMEOUT_MS
    );
    const stimulusVisibleAt = Date.now();

    await page.keyboard.press(" ");
    const keyPressedAt = Date.now();

    log.push({ phase, trialIndex: i, stimulusVisibleAt, keyPressedAt });

    // Let the game's own post-trial message/settle delay (600-800ms) pass
    // before the next trial's stimulus can appear.
    await page.waitForTimeout(900);
  }
}

export async function runTrigger(
  page: Page
): Promise<TriggerActionLogEntry[]> {
  const log: TriggerActionLogEntry[] = [];

  await page.getByRole("button", { name: "Start practice" }).click();
  await playRound(page, "practice", PRACTICE_TRIAL_COUNT, log);

  await page
    .getByRole("button", { name: "Start the real round" })
    .click({ timeout: 15_000 });

  // Advancing past practice remounts TriggerGame fresh (key={step} in the
  // sequence wrapper) in scored mode, idle phase — its own "Start" click is
  // required before the scored round's trials begin.
  await page
    .getByRole("button", { name: "Start", exact: true })
    .click({ timeout: 15_000 });
  await playRound(page, "scored", SCORED_TRIAL_COUNT, log);

  // Scored done-screen: runTask() has already awaited every saveTrial() call
  // (success or exhausted retries) before this screen can render — see
  // trigger-game.tsx's runTask(). Safe to read Supabase immediately after.
  await page
    .getByText(/Session Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });

  return log;
}
