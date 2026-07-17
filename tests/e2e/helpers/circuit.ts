import type { Page } from "@playwright/test";

/**
 * Drives Circuit's practice + scored rounds. Self-paced (no imposed timing —
 * src/components/games/circuit-game.tsx has no per-node deadline), so the
 * helper just taps the fixed alternating sequence in order, correctly,
 * as fast as Playwright can click. No deliberate wrong taps.
 */
export type CircuitActionLogEntry = {
  phase: "practice" | "scored";
  trialIndex: number;
  nodeId: string;
  tappedAt: number;
};

// src/lib/circuit/board.ts SEQUENCE (fixed science — do not reorder).
const SEQUENCE = [
  "1", "A", "2", "B", "3", "C", "4", "D",
  "5", "E", "6", "F", "7", "G", "8", "H",
] as const;
const PRACTICE_SEQUENCE = SEQUENCE.slice(0, 6); // src/components/games/circuit-game.tsx PRACTICE_NODE_COUNT

async function playRound(
  page: Page,
  phase: "practice" | "scored",
  sequence: readonly string[],
  log: CircuitActionLogEntry[]
): Promise<void> {
  for (let i = 0; i < sequence.length; i++) {
    const nodeId = sequence[i];
    // Nodes are <button>{node.id}</button> — text content is the exact node
    // id (1-8, A-H), all unique on the board, no ambiguity with other named
    // buttons ("Start"/"Continue"/etc). Board container is hidden until the
    // reveal frame; Playwright's click() already waits for actionability
    // (visible + enabled), so no manual visibility poll is needed here —
    // unlike Trigger/Gatekeeper/Echo's timed stimulus.
    await page
      .getByRole("button", { name: nodeId, exact: true })
      .click({ timeout: 10_000 });
    log.push({ phase, trialIndex: i, nodeId, tappedAt: Date.now() });
  }
}

export async function runCircuit(page: Page): Promise<CircuitActionLogEntry[]> {
  const log: CircuitActionLogEntry[] = [];

  await page.getByRole("button", { name: "Start practice" }).click();
  await playRound(page, "practice", PRACTICE_SEQUENCE, log);

  await page
    .getByRole("button", { name: "Start the real round" })
    .click({ timeout: 15_000 });

  // Same remount behavior as Trigger/Gatekeeper/Echo: advancing past
  // practice mounts a fresh CircuitGame in scored mode, idle phase — needs
  // its own "Start".
  await page
    .getByRole("button", { name: "Start", exact: true })
    .click({ timeout: 15_000 });
  await playRound(page, "scored", SEQUENCE, log);

  // Scored done-screen: runTask() has already awaited every saveTrial() call
  // before this screen can render (same pattern as the other games) — safe
  // to read Supabase immediately after.
  await page
    .getByText(/Session Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });

  return log;
}
