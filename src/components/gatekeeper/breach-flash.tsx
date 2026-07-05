"use client";

import { AnimatePresence, motion } from "framer-motion";

type BreachFlashProps = {
  // Increments on every no-go commission error; 0 = none yet this run.
  breachTick: number;
  reducedMotion: boolean;
};

/** Full-viewport red pulse on a breach. Skipped under reduced motion — the
 * on-screen "BREACH" message already carries the feedback without motion. */
export function BreachFlash({ breachTick, reducedMotion }: BreachFlashProps) {
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {breachTick > 0 && (
        <motion.div
          key={breachTick}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-50 bg-destructive"
        />
      )}
    </AnimatePresence>
  );
}
