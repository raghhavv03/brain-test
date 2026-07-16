"use client";

/*
 * ZoneSweep — the shared shell↔lab transition primitive (Phase 4.2, §8a).
 *
 * A ~400ms radial clip-path sweep, portaled to <body>, irising a solid
 * overlay out from a click point to cover the viewport before navigating.
 * Used for both directions of the shell↔lab boundary:
 *   - EnterLabButton: light shell -> dark lab (overlay carries `.lab`)
 *   - ExitLabLink: dark lab -> light shell (overlay carries no zone class,
 *     so it renders in the default/shell background token)
 *
 * Portaled to <body> because a sticky header's backdrop-blur (or any other
 * ancestor with a CSS containing-block trigger) would trap a position:fixed
 * child otherwise.
 */

import { motion } from "framer-motion";

export const ZONE_SWEEP_SECONDS = 0.4;

export type SweepOrigin = { x: number; y: number };

export function ZoneSweep({
  origin,
  theme,
  onDone,
}: {
  origin: SweepOrigin;
  /** "lab" applies the dark lab background token; "shell" uses the default. */
  theme: "lab" | "shell";
  onDone: () => void;
}) {
  // Radius that guarantees full viewport coverage from the click point.
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  return (
    <motion.div
      aria-hidden
      className={`fixed inset-0 z-[100] bg-background ${theme === "lab" ? "lab" : ""}`}
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
      animate={{ clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)` }}
      transition={{ duration: ZONE_SWEEP_SECONDS, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onDone}
    />
  );
}

/** Keyboard activation reports clientX/Y as 0 — fall back to element center. */
export function resolveSweepOrigin(
  event: { clientX: number; clientY: number; currentTarget: EventTarget & Element },
): SweepOrigin {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX || rect.left + rect.width / 2,
    y: event.clientY || rect.top + rect.height / 2,
  };
}
