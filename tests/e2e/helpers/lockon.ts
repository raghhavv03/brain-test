import type { Page } from "@playwright/test";

/**
 * Drives Lock-On's practice round + one deterministic-miss scored round.
 *
 * Mechanic check done before writing this (per the ask — inspected
 * src/components/games/lockon-game.tsx directly, didn't assume):
 * neither of the two hypothesized branches matches reality.
 * `handlePointerDown` finds the nearest object regardless of click position
 * and simply `return`s (no state change at all — not even a recorded miss)
 * if that nearest object is outside `hitRadius`. A click on empty space is
 * silently discarded, not registered as anything. Separately, "Confirm
 * lock" only becomes clickable once exactly `k` real objects are selected
 * (`disabled={selectedCount !== roundK}`) — there is no single-click
 * hit/miss mechanic; selection is "pick exactly k of the n on-screen
 * objects, then confirm." So a deterministic miss requires clicking k real,
 * distinct objects where at least one is a genuine non-target.
 *
 * src/lib/lockon/round.ts's `pickTargets` confirmed target assignment is a
 * uniformly random k-subset of the n = 2k objects with no exploitable
 * structure (Fisher-Yates over all indices) — so picking an arbitrary
 * k-subset blind would only be a miss ~95% of the time at k=3
 * (19/20 = 1 - 1/C(6,3)), which isn't the "deterministic" the task asked
 * for. Instead this helper does the honest thing: it independently detects
 * which objects are real targets by reading the marking-phase reticle
 * pixels off the canvas (the same "never trust the generator, verify from
 * the actual rendered/saved artifact" discipline used throughout this
 * suite and the project's own Lock-On verification history, §9d), then
 * tracks object identity through the 6s motion phase via nearest-neighbor
 * matching on repeated canvas samples. This is reliable specifically
 * because src/lib/lockon/physics.ts's `SEPARATION_FACTOR` guarantees
 * objects never come closer than `radius * 2.5` (45px at OBJECT_RADIUS=18)
 * — at max speed 170px/s, a 100ms sampling interval bounds inter-sample
 * displacement to ~17px, well under half that separation floor, so
 * nearest-neighbor identity never has to resolve an ambiguous crossing.
 * Once identities are tracked to the frozen selection-phase positions, the
 * helper clicks exactly the objects it independently verified are NOT
 * targets — guaranteeing correctCount = 0 < k regardless of chance.
 */
export type LockonActionLogEntry = {
  phase: "practice" | "scored";
  roundIndex: 0;
  k: number;
  numObjects: number;
  targetsDetected: number;
  clickedLogicalPoints: { x: number; y: number }[];
  reason: string;
};

const SAMPLE_INTERVAL_MS = 100;
const MARKING_CAPTURE_DELAY_MS = 400; // safely inside markMs(k) = 1500 + 250k
const TRACKING_TIMEOUT_MS = 9_000; // generous vs. the fixed 6000ms motion window
const BODY_MIN_COUNT = 50; // filters out thin ring/tick stroke fragments
const BODY_COLOR_THRESHOLD = 40; // Euclidean RGB distance from background
const TARGET_RING_THRESHOLD = 40; // distance from primary color
// drawReticle (lockon-game.tsx) draws the ring at OBJECT_RADIUS+6 = 24
// logical px, width 2 — scan only that thin annulus (22-26), not the ticks
// (which reach out to +16 = 34) or a plain box. This is provably safe
// against a neighboring object's reticle bleeding in at the game's minimum
// spawn gap (54px, round.ts SPAWN_GAP): the closest a neighbor's own
// ring pixel (itself at radius <=26 from ITS center) can get to THIS
// object's center is 54-26=28, outside this 22-26 window. A wider box
// (previously ±40px) had no such guarantee and produced a false positive.
const TARGET_RING_INNER_LOGICAL = 22;
const TARGET_RING_OUTER_LOGICAL = 26;
const TARGET_MIN_PIXELS = 5; // primary-colored pixels required to call it a target

type Rgb = { r: number; g: number; b: number };
type DeviceBody = { x: number; y: number };
type TrackedBody = DeviceBody & { isTarget: boolean };

async function readCanvasColors(
  page: Page
): Promise<{ dpr: number; width: number; height: number; bg: Rgb; primary: Rgb }> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const parseRgb = (s: string): { r: number; g: number; b: number } => {
      const m = s.match(/[\d.]+/g)!.map(Number);
      return { r: m[0], g: m[1], b: m[2] };
    };
    const bg = parseRgb(getComputedStyle(canvas).backgroundColor);

    // getComputedStyle normalizes to rgb(...) regardless of the source
    // syntax (hex/oklch/etc) — reading it off a throwaway element sidesteps
    // parsing whatever raw --primary syntax the design tokens use.
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    probe.style.position = "fixed";
    probe.style.opacity = "0";
    document.body.appendChild(probe);
    const primary = parseRgb(getComputedStyle(probe).color);
    probe.remove();

    return {
      dpr: window.devicePixelRatio || 1,
      width: canvas.width,
      height: canvas.height,
      bg,
      primary,
    };
  });
}

/** Flood-fills non-background pixels into blobs, returns device-pixel centroids. */
async function detectBodies(
  page: Page,
  bg: Rgb
): Promise<DeviceBody[]> {
  return page.evaluate(
    ({ bg, minCount, colorThreshold }) => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const { width, height } = canvas;
      const { data } = ctx.getImageData(0, 0, width, height);
      const visited = new Uint8Array(width * height);
      const bodies: { x: number; y: number }[] = [];
      const step = 2;

      const isForeground = (idx: number): boolean => {
        const a = data[idx * 4 + 3];
        if (a < 200) return false;
        const dr = data[idx * 4] - bg.r;
        const dg = data[idx * 4 + 1] - bg.g;
        const db = data[idx * 4 + 2] - bg.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) > colorThreshold;
      };

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = y * width + x;
          if (visited[idx]) continue;
          if (!isForeground(idx)) continue;

          const stack: [number, number][] = [[x, y]];
          visited[idx] = 1;
          let sumX = 0;
          let sumY = 0;
          let count = 0;

          while (stack.length) {
            const [cx, cy] = stack.pop()!;
            sumX += cx;
            sumY += cy;
            count++;
            for (const [dx, dy] of [
              [step, 0],
              [-step, 0],
              [0, step],
              [0, -step],
            ] as const) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const nIdx = ny * width + nx;
              if (visited[nIdx]) continue;
              if (!isForeground(nIdx)) continue;
              visited[nIdx] = 1;
              stack.push([nx, ny]);
            }
          }

          if (count < minCount) continue;
          bodies.push({ x: sumX / count, y: sumY / count });
        }
      }

      return bodies;
    },
    { bg, minCount: BODY_MIN_COUNT, colorThreshold: BODY_COLOR_THRESHOLD }
  );
}

/** For each body center, counts primary-colored pixels in the reticle ring's own thin annulus — see the TARGET_RING_* comment above for why this radius band, not a box, is what makes detection safe against nearby objects. */
async function detectTargetFlags(
  page: Page,
  bodies: DeviceBody[],
  primary: Rgb,
  dpr: number
): Promise<boolean[]> {
  return page.evaluate(
    ({ bodies, primary, innerR, outerR, colorThreshold, minPixels }) => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const { width, height } = canvas;
      const { data } = ctx.getImageData(0, 0, width, height);

      return bodies.map(({ x: cx, y: cy }) => {
        let hits = 0;
        const x0 = Math.max(0, Math.floor(cx - outerR));
        const x1 = Math.min(width - 1, Math.ceil(cx + outerR));
        const y0 = Math.max(0, Math.floor(cy - outerR));
        const y1 = Math.min(height - 1, Math.ceil(cy + outerR));
        for (let y = y0; y <= y1 && hits < minPixels; y++) {
          for (let x = x0; x <= x1 && hits < minPixels; x++) {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist < innerR || dist > outerR) continue;
            const idx = y * width + x;
            const a = data[idx * 4 + 3];
            if (a < 200) continue;
            const dr = data[idx * 4] - primary.r;
            const dg = data[idx * 4 + 1] - primary.g;
            const db = data[idx * 4 + 2] - primary.b;
            if (Math.sqrt(dr * dr + dg * dg + db * db) < colorThreshold) {
              hits++;
            }
          }
        }
        return hits >= minPixels;
      });
    },
    {
      bodies,
      primary,
      innerR: TARGET_RING_INNER_LOGICAL * dpr,
      outerR: TARGET_RING_OUTER_LOGICAL * dpr,
      colorThreshold: TARGET_RING_THRESHOLD,
      minPixels: TARGET_MIN_PIXELS,
    }
  );
}

function nearestNeighborTrack(
  tracked: TrackedBody[],
  newBodies: DeviceBody[]
): TrackedBody[] {
  // Physics guarantees >=45px separation between any two objects, and a
  // 100ms sample bounds displacement well under that — so each previous
  // body has exactly one unambiguous nearest new body.
  const used = new Set<number>();
  return tracked.map((prev) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    newBodies.forEach((b, i) => {
      if (used.has(i)) return;
      const d = Math.hypot(b.x - prev.x, b.y - prev.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    if (bestIdx === -1) return prev; // shouldn't happen; keep last known position
    used.add(bestIdx);
    return { ...newBodies[bestIdx], isTarget: prev.isTarget };
  });
}

async function playRound(
  page: Page,
  phase: "practice" | "scored",
  log: LockonActionLogEntry[]
): Promise<void> {
  // LEVEL K{roundK} badge is the only DOM signal for the round's k — read
  // it instead of assuming (practice is k=2, scored starts at k=3).
  const levelBadge = page.getByText(/LEVEL K\d+/);
  await levelBadge.waitFor({ state: "visible", timeout: 5_000 });
  const levelText = await levelBadge.innerText();
  const k = Number(levelText.match(/LEVEL K(\d+)/)?.[1]);
  if (!k) throw new Error(`Could not read K from "${levelText}"`);
  const numObjects = 2 * k; // src/lib/lockon/round.ts numObjects()

  await page.waitForTimeout(MARKING_CAPTURE_DELAY_MS);

  const { bg, primary, dpr } = await readCanvasColors(page);
  const markingBodies = await detectBodies(page, bg);
  if (markingBodies.length !== numObjects) {
    throw new Error(
      `Expected ${numObjects} objects at marking, detected ${markingBodies.length}`
    );
  }
  const targetFlags = await detectTargetFlags(page, markingBodies, primary, dpr);
  let tracked: TrackedBody[] = markingBodies.map((b, i) => ({
    ...b,
    isTarget: targetFlags[i],
  }));

  const targetsDetected = tracked.filter((t) => t.isTarget).length;
  if (targetsDetected !== k) {
    throw new Error(
      `Expected ${k} targets detected at marking, got ${targetsDetected}`
    );
  }

  // Track identity through motion via repeated nearest-neighbor matching
  // until the Confirm button appears (phase === "select" — canvas is
  // frozen and reticles are gone by then, per the file-level comment).
  const confirmButton = page.getByRole("button", { name: "Confirm lock" });
  const deadline = Date.now() + TRACKING_TIMEOUT_MS;
  while (!(await confirmButton.isVisible())) {
    if (Date.now() > deadline) {
      throw new Error("Confirm lock button never appeared — motion phase timed out");
    }
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    const bodies = await detectBodies(page, bg);
    if (bodies.length === numObjects) {
      tracked = nearestNeighborTrack(tracked, bodies);
    }
    // A short-lived detection miss (e.g. a frame mid-collision) is skipped
    // rather than corrupting tracked identity with a wrong count — the next
    // sample picks the trail back up.
  }

  // Selection is frozen now — one more sample for the precise final
  // positions, matched against the last tracked identities.
  const finalBodies = await detectBodies(page, bg);
  if (finalBodies.length === numObjects) {
    tracked = nearestNeighborTrack(tracked, finalBodies);
  }

  const nonTargets = tracked.filter((t) => !t.isTarget).slice(0, k);
  if (nonTargets.length !== k) {
    throw new Error(
      `Expected ${k} tracked non-targets to click, got ${nonTargets.length}`
    );
  }

  const canvasBox = await page.locator("canvas").boundingBox();
  if (!canvasBox) throw new Error("Canvas has no bounding box");
  const logicalArenaWidth = 600; // src/lib/lockon/round.ts ARENA
  const logicalArenaHeight = 400;

  const clickedLogicalPoints: { x: number; y: number }[] = [];
  for (const obj of nonTargets) {
    const logicalX = obj.x / dpr;
    const logicalY = obj.y / dpr;
    const pageX = canvasBox.x + (logicalX / logicalArenaWidth) * canvasBox.width;
    const pageY = canvasBox.y + (logicalY / logicalArenaHeight) * canvasBox.height;
    await page.mouse.click(pageX, pageY);
    clickedLogicalPoints.push({ x: logicalX, y: logicalY });
  }

  log.push({
    phase,
    roundIndex: 0,
    k,
    numObjects,
    targetsDetected,
    clickedLogicalPoints,
    reason:
      "clicked all k objects independently verified (marking-phase reticle pixels, tracked through motion) as non-targets — guarantees correctCount=0 < k",
  });

  await confirmButton.click({ timeout: 15_000 });
}

export async function runLockon(page: Page): Promise<LockonActionLogEntry[]> {
  const log: LockonActionLogEntry[] = [];

  await page.getByRole("button", { name: "Start practice" }).click();
  await playRound(page, "practice", log);

  await page
    .getByText(/Practice Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });
  await page
    .getByRole("button", { name: "Start the real round" })
    .click({ timeout: 15_000 });

  // Same remount behavior as the other games: advancing past practice
  // mounts a fresh LockOnGame in scored mode, idle phase — needs its own
  // "Start".
  await page
    .getByRole("button", { name: "Start", exact: true })
    .click({ timeout: 15_000 });
  await playRound(page, "scored", log);

  // The deliberate miss ends escalation immediately (nextEscalation:
  // !correct -> done, reason "miss") — exactly one scored round, then the
  // feedback pause (1500ms) and save. Safe to read Supabase after this.
  await page
    .getByText(/Session Complete/i)
    .waitFor({ state: "visible", timeout: 15_000 });

  return log;
}
