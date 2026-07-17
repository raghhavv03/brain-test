import type { Page } from "@playwright/test";
import { waitForTargetVisibility } from "./wait-for-visibility";

/**
 * Drives Echo's practice + scored rounds. The helper tracks its own
 * sliding window of the last two displayed letters and presses Space only
 * when the current letter genuinely matches two-back — computed
 * independently from what it reads off the DOM, the same "never trust the
 * generator" discipline src/lib/echo/item-sequence.ts's isTarget() uses
 * (recomputes from the actual sequence, not a designated-position list).
 * Clean run only: every genuine match gets pressed, every non-match is
 * withheld — no deliberate false alarms/misses.
 */
export type EchoActionLogEntry = {
  phase: "practice" | "scored";
  itemIndex: number;
  letter: string;
  computedMatch: boolean;
  actionTaken: "pressed" | "withheld";
};

const PRACTICE_ITEM_COUNT = 8; // src/components/games/echo-game.tsx PRACTICE_ITEMS
const SCORED_ITEM_COUNT = 24; // src/lib/echo/item-sequence.ts TOTAL_ITEMS
const VISIBLE_TIMEOUT_MS = 5_000; // generous vs. the game's fixed 2500ms SOA
const HIDDEN_TIMEOUT_MS = 3_000; // generous vs. the 500ms visible window

async function playRound(
  page: Page,
  phase: "practice" | "scored",
  itemCount: number,
  log: EchoActionLogEntry[]
): Promise<void> {
  // Sliding window of the last two letters actually observed, oldest first —
  // the helper's own 2-back ground truth, independent of the app's.
  const lastTwo: string[] = [];

  for (let i = 0; i < itemCount; i++) {
    await waitForTargetVisibility(page, "visible", VISIBLE_TIMEOUT_MS);
    const letter = (await page.locator("[data-target]").innerText()).trim();

    const computedMatch = lastTwo.length === 2 && lastTwo[0] === letter;

    let actionTaken: "pressed" | "withheld";
    if (computedMatch) {
      await page.keyboard.press(" ");
      actionTaken = "pressed";
    } else {
      actionTaken = "withheld";
    }

    log.push({ phase, itemIndex: i, letter, computedMatch, actionTaken });

    lastTwo.push(letter);
    if (lastTwo.length > 2) lastTwo.shift();

    // Letter is visible for a fixed 500ms out of the fixed 2500ms SOA — wait
    // for it to go blank before polling for the next item's onset, or a
    // still-visible frame from *this* item could be read as the next one.
    await waitForTargetVisibility(page, "hidden", HIDDEN_TIMEOUT_MS);
  }
}

export async function runEcho(page: Page): Promise<EchoActionLogEntry[]> {
  const log: EchoActionLogEntry[] = [];

  await page.getByRole("button", { name: "Start practice" }).click();
  await playRound(page, "practice", PRACTICE_ITEM_COUNT, log);

  await page
    .getByRole("button", { name: "Start the real round" })
    .click({ timeout: 15_000 });

  // Same remount behavior as Trigger/Gatekeeper: advancing past practice
  // mounts a fresh EchoGame in scored mode, idle phase — needs its own
  // "Start".
  await page
    .getByRole("button", { name: "Start", exact: true })
    .click({ timeout: 15_000 });
  await playRound(page, "scored", SCORED_ITEM_COUNT, log);

  // Scored done-screen: runTask() has already awaited every saveTrial() call
  // before this screen can render (same pattern as Trigger/Gatekeeper) —
  // safe to read Supabase immediately after.
  await page
    .getByText(/Session Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });

  return log;
}
