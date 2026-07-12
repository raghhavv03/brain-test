"use client";

import { AnimatePresence, motion } from "framer-motion";

export type PrevItemFeedback = {
  itemNumber: number; // 1-based, so the chip always names its own item
  classification: "hit" | "false_alarm" | "miss" | "correct_rejection";
  rtMs: number | null;
};

const COPY: Record<PrevItemFeedback["classification"], string> = {
  hit: "Match — decoded",
  miss: "Match missed",
  false_alarm: "False decode",
  correct_rejection: "No match — held",
};

const TONE: Record<PrevItemFeedback["classification"], string> = {
  hit: "border-primary/40 text-primary",
  miss: "border-destructive/40 text-destructive",
  false_alarm: "border-destructive/40 text-destructive",
  correct_rejection: "border-border text-muted-foreground",
};

/**
 * The previous item's outcome, styled as a spent "decoded signal" chip so it
 * can never be mistaken for the letter currently on screen: small, dimmed,
 * explicitly labelled with its own signal number, and pushed below the
 * decoder. Purely presentational — receives an already-classified item.
 */
export function PrevFeedback({
  feedback,
  reducedMotion,
}: {
  feedback: PrevItemFeedback | null;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex min-h-[2rem] items-center justify-center">
      <AnimatePresence mode="popLayout">
        {feedback && (
          <motion.div
            key={feedback.itemNumber}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex items-center gap-2 rounded-full border bg-background/40 px-3 py-1 opacity-80 ${TONE[feedback.classification]}`}
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Prev · Signal {feedback.itemNumber}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest">
              {COPY[feedback.classification]}
              {feedback.rtMs !== null
                ? ` · ${Math.round(feedback.rtMs)} ms`
                : ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
