/**
 * Lock-On (MOT) physics — pure stepping logic for the motion phase.
 *
 * Non-looping guarantee: every step perturbs each object's heading by a
 * fresh, bounded random amount (a random walk in direction), so no
 * trajectory has a period and none can be extrapolated. Randomness comes
 * from Math.random() at step time — never seeded, never precomputed.
 *
 * Speeds are invariant: heading jitter is a rotation and wall/object
 * collisions reflect velocities, so every object keeps the speed it spawned
 * with and difficulty stays uniform through the round.
 */

export type MovingObject = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type Bounds = { width: number; height: number };

// Max random heading change per second (radians). Bounded so motion stays
// smooth; non-zero so paths never settle into straight, predictable lines.
const MAX_TURN_RATE = Math.PI * 0.6;

// A single janky frame is clamped so objects can't tunnel through walls or
// each other. Total motion time is measured in real time by the caller, and
// a stalled tab discards the round via the visibility watcher regardless.
const MAX_STEP_S = 0.05;

// Objects repel before they visually touch, so two objects never fully
// occlude each other (which would make tracking ambiguous).
const SEPARATION_FACTOR = 2.5;

export function stepPhysics(
  objects: MovingObject[],
  dtSeconds: number,
  bounds: Bounds,
  radius: number
): void {
  const dt = Math.min(dtSeconds, MAX_STEP_S);
  if (dt <= 0) return;

  for (const o of objects) {
    // Random-walk steering: rotate velocity by a bounded random angle.
    const turn = (Math.random() * 2 - 1) * MAX_TURN_RATE * dt;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const vx = o.vx * cos - o.vy * sin;
    const vy = o.vx * sin + o.vy * cos;
    o.vx = vx;
    o.vy = vy;

    o.x += o.vx * dt;
    o.y += o.vy * dt;

    // Reflect off arena walls.
    if (o.x < radius) {
      o.x = radius * 2 - o.x;
      o.vx = Math.abs(o.vx);
    } else if (o.x > bounds.width - radius) {
      o.x = (bounds.width - radius) * 2 - o.x;
      o.vx = -Math.abs(o.vx);
    }
    if (o.y < radius) {
      o.y = radius * 2 - o.y;
      o.vy = Math.abs(o.vy);
    } else if (o.y > bounds.height - radius) {
      o.y = (bounds.height - radius) * 2 - o.y;
      o.vy = -Math.abs(o.vy);
    }
  }

  // Pairwise separation + bounce.
  const minDist = radius * SEPARATION_FACTOR;
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;

      // Collision normal from a to b (arbitrary axis if exactly coincident).
      const nx = dist > 1e-6 ? dx / dist : 1;
      const ny = dist > 1e-6 ? dy / dist : 0;

      // Push both out to the separation distance.
      const push = (minDist - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;

      // Reflect whichever object is moving toward the other, preserving
      // each object's speed.
      const aTowards = a.vx * nx + a.vy * ny;
      if (aTowards > 0) {
        a.vx -= 2 * aTowards * nx;
        a.vy -= 2 * aTowards * ny;
      }
      const bTowards = b.vx * nx + b.vy * ny;
      if (bTowards < 0) {
        b.vx -= 2 * bTowards * nx;
        b.vy -= 2 * bTowards * ny;
      }
    }
  }

  // Separation can push an object past a wall; clamp every center back
  // inside the arena so nothing jitters against a corner across frames.
  for (const o of objects) {
    o.x = Math.min(Math.max(o.x, radius), bounds.width - radius);
    o.y = Math.min(Math.max(o.y, radius), bounds.height - radius);
  }
}
