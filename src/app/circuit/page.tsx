"use client";

import { useEffect, useRef, useState } from "react";
import { ensureSession } from "@/lib/supabase/session";
import {
  createVisibilityWatcher,
  showStimulusAtNextFrame,
  type VisibilityWatcher,
} from "@/lib/engine/measurement";
import { saveTrial } from "@/lib/engine/save-trials";
import { BOARD, SEQUENCE, createBoard, type CircuitNode } from "@/lib/circuit/board";

const GAME = "circuit";

type Phase = "idle" | "running" | "done";

type TapRecord = {
  trialIndex: number;
  expected: string;
  tapped: string;
  rtMs: number;
  // Time since the very first tap of the run (correct or wrong), independent
  // of rt_ms's shifting reference chain — this is what makes total
  // completion time (first tap to the correct H tap) reconstructable from
  // the raw rows alone, even when the very first tap was wrong.
  elapsedSinceFirstTapMs: number;
  correct: boolean;
};

export default function CircuitPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<CircuitNode[]>([]);
  const [message, setMessage] = useState("");
  const [taps, setTaps] = useState<TapRecord[]>([]);
  const [completionMs, setCompletionMs] = useState<number | null>(null);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);

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

      const expected = SEQUENCE[expectedIndexRef.current];
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
        if (expectedIndexRef.current === SEQUENCE.length) {
          const totalMs = timestamp - (firstTapMsRef.current as number);
          completionResolverRef.current?.(totalMs);
          completionResolverRef.current = null;
        }
      } else {
        setMessage("Wrong — try again");
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
      setBoard(createBoard());

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
          game: GAME,
          trial_index: t.trialIndex,
          stimulus: {
            expected: t.expected,
            sequence_position: SEQUENCE.indexOf(
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

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-6">
      <h1>Circuit</h1>
      <p>
        Tap the circles in order — 1, A, 2, B, 3, C… alternating number and
        letter, ascending — until you reach H.
      </p>

      <div
        ref={boardContainerRef}
        style={{
          position: "relative",
          width: BOARD.width,
          height: BOARD.height,
          maxWidth: "100%",
          border: "1px solid #999",
          visibility: "hidden",
        }}
      >
        {board.map((node) => (
          <button
            key={node.id}
            onPointerDown={handleTap(node.id)}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            {node.id}
          </button>
        ))}
      </div>

      {phase === "running" && (
        <p>
          Taps: {taps.length} · Errors: {errorCount}
        </p>
      )}
      <p>{phase === "running" ? message : ""}</p>

      {phase === "idle" && <button onClick={runTask}>Start</button>}

      {phase === "done" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2>Done</h2>
          {fatalError && <p>Error: {fatalError}</p>}
          <p>
            Completion time:{" "}
            {completionMs !== null ? `${Math.round(completionMs)} ms` : "—"}
          </p>
          <p>Errors: {errorCount}</p>
          <p>Save failures: {saveFailures}</p>
          <details>
            <summary>Per-tap log</summary>
            <ol>
              {taps.map((t) => (
                <li key={t.trialIndex}>
                  {String(t.trialIndex + 1).padStart(2, "0")} · tapped{" "}
                  {t.tapped} · {Math.round(t.rtMs)} ms ·{" "}
                  {t.correct ? "correct" : "wrong"}
                </li>
              ))}
            </ol>
          </details>
          <button onClick={runTask}>Run again</button>
        </div>
      )}
    </main>
  );
}
