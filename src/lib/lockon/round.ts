import type { MovingObject } from "./physics";

/**
 * Lock-On (MOT) skeleton — fixed science. Do not tune these values to make
 * the game feel easier or harder without explicit approval.
 */
export const START_K = 3;
// Capacity ceiling (~4-5 tracked objects at moderate speed) plus phone
// touch-target margins at N=12 — not an object-count artifact.
export const MAX_K = 6;
export const MOTION_MS = 6000;

/**
 * Total objects on screen: N = 2K, so distractors always equal targets.
 * Effective tracking load is min(K, N−K); with N = 2K the complement-set
 * strategy (tracking distractors by elimination) never pays and difficulty
 * is monotonic in K at every level.
 */
export function numObjects(k: number): number {
  return 2 * k;
}

/**
 * Marking window scales with K so encoding-time pressure per target stays
 * constant — a flat window would confound tracking capacity with encoding
 * speed at higher K.
 */
export function markMs(k: number): number {
  return 1500 + 250 * k;
}
// A discarded (tab-hidden) round repeats its K; after this many consecutive
// discards the session is too interrupted to measure and the game ends.
export const MAX_CONSECUTIVE_DISCARDS = 3;

/** Logical arena size — rendering scales this; physics always runs in it. */
export const ARENA = { width: 600, height: 400 };
export const OBJECT_RADIUS = 18;

const SPEED_MIN = 130; // px/s
const SPEED_MAX = 170;
const SPAWN_MARGIN = OBJECT_RADIUS * 2; // min distance from walls at spawn
const SPAWN_GAP = OBJECT_RADIUS * 3; // min center-to-center distance at spawn

export type Round = {
  k: number;
  objects: MovingObject[];
  /**
   * Random subset of object indices (not slots 0..k-1), so draw order
   * carries no information about which objects are targets.
   */
  targetIndices: number[];
};

export function createRound(k: number): Round {
  const count = numObjects(k);
  return {
    k,
    objects: placeObjects(count),
    targetIndices: pickTargets(k, count),
  };
}

function placeObjects(count: number): MovingObject[] {
  const objects: MovingObject[] = [];
  let attempts = 0;
  while (objects.length < count) {
    // Practically unreachable at this density, but never loop unbounded on
    // an unlucky layout — throw away the partial placement and start over.
    if (++attempts > 5000) {
      objects.length = 0;
      attempts = 0;
    }
    const x = SPAWN_MARGIN + Math.random() * (ARENA.width - SPAWN_MARGIN * 2);
    const y = SPAWN_MARGIN + Math.random() * (ARENA.height - SPAWN_MARGIN * 2);
    if (objects.some((o) => Math.hypot(o.x - x, o.y - y) < SPAWN_GAP)) {
      continue;
    }
    const heading = Math.random() * Math.PI * 2;
    const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    objects.push({
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
    });
  }
  return objects;
}

function pickTargets(k: number, count: number): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, k).sort((a, b) => a - b);
}

export type EscalationState = { k: number; consecutiveDiscards: number };

export type EndReason = "miss" | "cap" | "discards";

export type EscalationResult =
  | { done: false; next: EscalationState }
  | { done: true; reason: EndReason };

/**
 * Staircase-to-failure: pass → K+1 (until MAX_K), first miss → end. A
 * discarded round never moves K; too many consecutive discards ends the
 * game instead of retrying forever.
 */
export function nextEscalation(
  state: EscalationState,
  outcome: { correct: boolean; discarded: boolean }
): EscalationResult {
  if (outcome.discarded) {
    const consecutiveDiscards = state.consecutiveDiscards + 1;
    if (consecutiveDiscards >= MAX_CONSECUTIVE_DISCARDS) {
      return { done: true, reason: "discards" };
    }
    return { done: false, next: { k: state.k, consecutiveDiscards } };
  }
  if (!outcome.correct) return { done: true, reason: "miss" };
  if (state.k >= MAX_K) return { done: true, reason: "cap" };
  return { done: false, next: { k: state.k + 1, consecutiveDiscards: 0 } };
}
