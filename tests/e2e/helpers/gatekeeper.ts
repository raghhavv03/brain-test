import type { Page } from "@playwright/test";
import { waitForTargetVisibility } from "./wait-for-visibility";

/**
 * Drives Gatekeeper's practice + scored rounds. Clean run only: presses
 * Space on every go signal, deliberately withholds on every no-go — no
 * commission errors, same "unambiguous outcome" scoping as Trigger.
 *
 * Stimulus type is randomized per run (src/lib/gatekeeper/trial-sequence.ts
 * shuffles a fixed 32-go/8-no-go composition) and isn't knowable ahead of
 * time, so the helper reads it off the DOM each trial rather than assuming
 * an order.
 */
export type GatekeeperActionLogEntry = {
  phase: "practice" | "scored";
  trialIndex: number;
  stimulusType: "go" | "no-go";
  actionTaken: "pressed" | "withheld";
};

const PRACTICE_TRIAL_COUNT = 10; // 8 go + 2 no-go, src/components/games/gatekeeper-game.tsx
const SCORED_TRIAL_COUNT = 40; // 32 go + 8 no-go, src/lib/gatekeeper/trial-sequence.ts
const VISIBLE_TIMEOUT_MS = 5_000; // generous vs. the game's fixed 500ms ISI
const HIDDEN_TIMEOUT_MS = 3_000; // generous vs. the game's 600ms response window

/**
 * GateSignal (src/components/gatekeeper/gate-signal.tsx) renders "Authorize"
 * for go / "Hostile" for no-go as a child <span> of the same [data-target]
 * element, styled `uppercase` — Playwright's innerText reflects computed
 * CSS text-transform, so this must compare case-insensitively (the exact
 * gotcha recorded in docs/project-reference.md §11).
 */
async function readStimulusType(page: Page): Promise<"go" | "no-go"> {
  const text = (await page.locator("[data-target]").innerText()).trim().toUpperCase();
  if (text.includes("AUTHORIZE")) return "go";
  if (text.includes("HOSTILE")) return "no-go";
  throw new Error(`Unrecognized Gatekeeper stimulus text: "${text}"`);
}

async function playRound(
  page: Page,
  phase: "practice" | "scored",
  trialCount: number,
  log: GatekeeperActionLogEntry[]
): Promise<void> {
  for (let i = 0; i < trialCount; i++) {
    await waitForTargetVisibility(page, "visible", VISIBLE_TIMEOUT_MS);
    const stimulusType = await readStimulusType(page);

    let actionTaken: "pressed" | "withheld";
    if (stimulusType === "go") {
      await page.keyboard.press(" ");
      actionTaken = "pressed";
    } else {
      actionTaken = "withheld";
    }

    log.push({ phase, trialIndex: i, stimulusType, actionTaken });

    // Trial ends (target hidden) as soon as a go response lands, or once the
    // full 600ms response window elapses for a withheld no-go — wait for
    // that transition before polling for the next trial's onset, or a
    // still-visible frame from *this* trial could be mistaken for the next.
    await waitForTargetVisibility(page, "hidden", HIDDEN_TIMEOUT_MS);
  }
}

export async function runGatekeeper(
  page: Page
): Promise<GatekeeperActionLogEntry[]> {
  const log: GatekeeperActionLogEntry[] = [];

  await page.getByRole("button", { name: "Start practice" }).click();
  await playRound(page, "practice", PRACTICE_TRIAL_COUNT, log);

  await page
    .getByRole("button", { name: "Start the real round" })
    .click({ timeout: 15_000 });

  // Same remount behavior as Trigger: advancing past practice mounts a
  // fresh GatekeeperGame in scored mode, idle phase — needs its own "Start".
  await page
    .getByRole("button", { name: "Start", exact: true })
    .click({ timeout: 15_000 });
  await playRound(page, "scored", SCORED_TRIAL_COUNT, log);

  // Scored done-screen: runTask() has already awaited every saveTrial() call
  // before this screen can render (same pattern as Trigger) — safe to read
  // Supabase immediately after.
  await page
    .getByText(/Session Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });

  return log;
}
