"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ensureSession } from "@/lib/supabase/session";
import {
  createVisibilityWatcher,
  showStimulusAtNextFrame,
  type VisibilityWatcher,
} from "@/lib/engine/measurement";
import { saveTrial } from "@/lib/engine/save-trials";
import { SEQUENCE, createBoard, type CircuitNode } from "@/lib/circuit/board";
import { useMotionPreference } from "@/lib/hooks/use-motion-preference";
import { Button } from "@/components/ui/button";
import { CircuitBoard } from "@/components/circuit/circuit-board";
import { ReducedMotionToggle } from "@/components/lab/reduced-motion-toggle";
import type { GameProps } from "@/components/games/types";

const GAME = "circuit";
// Practice: same tap rules on the sequence's first 6 nodes (1-A-2-B-3-C).
const PRACTICE_NODE_COUNT = 6;
const PRACTICE_SEQUENCE = SEQUENCE.slice(0, PRACTICE_NODE_COUNT);

type Phase = "idle" | "running" | "done";

type TapRecord = {
  trialIndex: number;
  expected: string;
  tapped: string;
  rtMs: number;
  // Time since the very first tap of the run (correct or wrong), independent
  // of rt_ms's shifting reference chain — this is what makes total
  // completion time (first tap to the correct final tap) reconstructable
  // from the raw rows alone, even when the very first tap was wrong.
  elapsedSinceFirstTapMs: number;
  correct: boolean;
};

export function CircuitGame({
  mode = "scored",
  runId = null,
  onComplete,
}: GameProps) {
  const isPractice = mode === "practice";
  const activeSequence = isPractice ? PRACTICE_SEQUENCE : SEQUENCE;

  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<CircuitNode[]>([]);
  const [message, setMessage] = useState("");
  const [taps, setTaps] = useState<TapRecord[]>([]);
  const [completionMs, setCompletionMs] = useState<number | null>(null);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reducedMotion, toggleReducedMotion] = useMotionPreference();

  const phaseRef = useRef<Phase>("idle");
  const runningRef = useRef(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const watcherRef = useRef<VisibilityWatcher | null>(null);

  // Sequence/timing state — refs so the tap handler reads/writes
  // synchronously, independent of React's render cycle.
  const expectedIndexRef = useRef(0);
  const firstTapMsRef = useRef<number | null>(null);
  const lastCorrectTapMsRef = useRef<number | null>(null);
  const boardOnsetMsRef = useRef<number | null>(null);
  const tapIndexRef = useRef(0);
  const tapsRef = useRef<TapRecord[]>([]);
  const completionResolverRef = useRef<((totalMs: number) => void) | null>(
    null
  );

  function transition(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  useEffect(() => {
    return () => {
      watcherRef.current?.destroy();
      watcherRef.current = null;
    };
  }, []);

  function handleTap(id: string) {
    return () => {
      const timestamp = performance.now();
      if (phaseRef.current !== "running") return;
      if (firstTapMsRef.current === null) firstTapMsRef.current = timestamp;

      const expected = activeSequence[expectedIndexRef.current];
      const correct = id === expected;
      // Reference point for rt_ms: the board-reveal onset until the first
      // correct tap happens, then the most recent correct tap after that.
      const referenceMs =
        lastCorrectTapMsRef.current ?? (boardOnsetMsRef.current as number);
      const rtMs = timestamp - referenceMs;
      const elapsedSinceFirstTapMs =
        timestamp - (firstTapMsRef.current as number);

      const record: TapRecord = {
        trialIndex: tapIndexRef.current++,
        expected,
        tapped: id,
        rtMs,
        elapsedSinceFirstTapMs,
        correct,
      };
      tapsRef.current.push(record);
      setTaps((prev) => [...prev, record]);

      if (correct) {
        lastCorrectTapMsRef.current = timestamp;
        expectedIndexRef.current += 1;
        setMessage("");
        if (expectedIndexRef.current === activeSequence.length) {
          const totalMs = timestamp - (firstTapMsRef.current as number);
          completionResolverRef.current?.(totalMs);
          completionResolverRef.current = null;
        }
      } else {
        setMessage("Link rejected — retrace");
      }
    };
  }

  async function runTask() {
    if (runningRef.current) return;
    runningRef.current = true;
    transition("running");
    setBoard([]);
    setTaps([]);
    setMessage("");
    setCompletionMs(null);
    setSaveFailures(0);
    setFatalError(null);

    expectedIndexRef.current = 0;
    firstTapMsRef.current = null;
    lastCorrectTapMsRef.current = null;
    boardOnsetMsRef.current = null;
    tapIndexRef.current = 0;
    tapsRef.current = [];

    const watcher = createVisibilityWatcher();
    watcherRef.current = watcher;
    watcher.reset();

    try {
      const sessionId = await ensureSession();

      const container = boardContainerRef.current;
      if (!container) throw new Error("Board element missing.");
      container.style.visibility = "hidden";
      setBoard(createBoard(activeSequence));

      const onsetMs = await showStimulusAtNextFrame(container);
      boardOnsetMsRef.current = onsetMs;

      const totalMs = await new Promise<number>((resolve) => {
        completionResolverRef.current = resolve;
      });
      setCompletionMs(totalMs);

      const discarded = watcher.compromised;
      const savePromises = tapsRef.current.map((t) =>
        saveTrial({
          session_id: sessionId,
          run_id: runId,
          game: GAME,
          trial_index: t.trialIndex,
          stimulus: {
            expected: t.expected,
            sequence_position: activeSequence.indexOf(
              t.expected as (typeof SEQUENCE)[number]
            ),
          },
          response: {
            tapped: t.tapped,
            elapsed_since_first_tap_ms: t.elapsedSinceFirstTapMs,
          },
          rt_ms: t.rtMs,
          correct: t.correct,
          discarded,
          is_practice: isPractice,
        })
          .then(() => true)
          .catch(() => false)
      );
      const saved = await Promise.all(savePromises);
      setSaveFailures(saved.filter((ok) => !ok).length);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : String(err));
    } finally {
      transition("done");
      watcher.destroy();
      watcherRef.current = null;
      runningRef.current = false;
    }
  }

  const errorCount = taps.filter((t) => !t.correct).length;
  const correctCount = taps.filter((t) => t.correct).length;
  const lastTap = taps.length > 0 ? taps[taps.length - 1] : null;
  const wrongNodeId = lastTap && !lastTap.correct ? lastTap.tapped : null;
  const lastNode = activeSequence[activeSequence.length - 1];

  return (
    <div className="lab flex min-h-screen flex-col items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Cognitive Performance Lab
        </span>
        <div className="flex items-center gap-3">
          {correctCount > 0 && phase === "running" && (
            <motion.span
              key={correctCount}
              initial={reducedMotion ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[11px] uppercase tracking-widest text-primary"
            >
              LINK {correctCount}/{activeSequence.length}
            </motion.span>
          )}
          <ReducedMotionToggle
            reducedMotion={reducedMotion}
            onToggle={toggleReducedMotion}
          />
        </div>
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-10 flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-border bg-card px-6 py-10 shadow-2xl sm:px-8"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-3xl font-semibold uppercase tracking-[0.2em]">
            Circuit
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {isPractice ? "Practice — not scored" : "Node Board"}
          </p>
        </div>

        {phase === "running" && (
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Taps {taps.length} · Errors {errorCount}
          </span>
        )}

        <CircuitBoard
          ref={boardContainerRef}
          board={board}
          sequence={activeSequence}
          completedCount={correctCount}
          wrongNodeId={wrongNodeId}
          wrongTick={taps.length}
          reducedMotion={reducedMotion}
          onNodeTap={handleTap}
        />

        <p className="min-h-[1.25rem] font-mono text-sm uppercase tracking-widest text-destructive">
          {phase === "running" ? message : ""}
        </p>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Charge the circuit: tap the nodes in order — 1, A, 2, B…
              alternating number and letter, ascending — until you reach{" "}
              {lastNode}. The trail lights up behind you.
            </p>
            <Button size="lg" onClick={runTask}>
              {isPractice ? "Start practice" : "Start"}
            </Button>
          </div>
        )}

        {phase === "done" && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {isPractice ? "Practice Complete" : "Session Complete"}
            </h2>
            {fatalError && (
              <p className="text-sm text-destructive">Error: {fatalError}</p>
            )}
            <div className="grid w-full grid-cols-2 gap-3">
              <StatBox
                label="Completion"
                value={
                  completionMs !== null
                    ? `${(completionMs / 1000).toFixed(1)} s`
                    : "—"
                }
              />
              <StatBox label="Errors" value={`${errorCount}`} />
              <StatBox
                label="Nodes"
                value={`${activeSequence.length}`}
              />
              <StatBox label="Taps" value={`${taps.length}`} />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Save failures: {saveFailures}
            </p>
            <details className="w-full">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Per-tap log
              </summary>
              <ol className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                {taps.map((t) => (
                  <li key={t.trialIndex}>
                    {String(t.trialIndex + 1).padStart(2, "0")} · tapped{" "}
                    {t.tapped} · {Math.round(t.rtMs)} ms ·{" "}
                    {t.correct ? "correct" : "wrong"}
                  </li>
                ))}
              </ol>
            </details>
            {onComplete ? (
              <Button
                size="lg"
                onClick={() => onComplete({ saveFailures, fatalError })}
              >
                {isPractice ? "Start the real round" : "Continue"}
              </Button>
            ) : (
              <Button size="lg" onClick={runTask}>
                Run again
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
