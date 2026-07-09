"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ensureSession } from "@/lib/supabase/session";
import {
  createVisibilityWatcher,
  sleep,
  type VisibilityWatcher,
} from "@/lib/engine/measurement";
import { saveTrial } from "@/lib/engine/save-trials";
import { stepPhysics } from "@/lib/lockon/physics";
import {
  ARENA,
  MAX_CONSECUTIVE_DISCARDS,
  MOTION_MS,
  OBJECT_RADIUS,
  START_K,
  createRound,
  markMs,
  nextEscalation,
  numObjects,
  type EndReason,
  type EscalationState,
  type Round,
} from "@/lib/lockon/round";
import type { GameProps } from "@/components/games/types";

const GAME = "lockon";
// Practice: one round at K=2 — below the scored K=3–6 range, same physics,
// marking, and selection mechanics, no escalation.
const PRACTICE_K = 2;
// Selection is spatial and untimed, so taps get a forgiving halo.
const HIT_PAD_PX = 10;
const FEEDBACK_MS = 1500; // between-round reveal — pacing only, not measured

type Phase = "idle" | "marking" | "motion" | "select" | "feedback" | "done";

type CompletedRound = {
  roundIndex: number;
  k: number;
  targetIndices: number[];
  selectedIndices: number[];
  correctCount: number;
  accuracy: number;
  correct: boolean;
  discarded: boolean;
};

type DrawOptions = {
  markTargets?: boolean;
  revealTargets?: boolean;
  selected?: ReadonlySet<number>;
};

export function LockOnGame({
  mode = "scored",
  runId = null,
  onComplete,
}: GameProps) {
  const isPractice = mode === "practice";
  const startK = isPractice ? PRACTICE_K : START_K;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLine, setStatusLine] = useState("");
  const [roundK, setRoundK] = useState(startK);
  const [selectedCount, setSelectedCount] = useState(0);
  const [rounds, setRounds] = useState<CompletedRound[]>([]);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundRef = useRef<Round | null>(null);
  const selectedRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>("idle");
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const confirmRef = useRef<(() => void) | null>(null);
  const watcherRef = useRef<VisibilityWatcher | null>(null);

  function transition(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = ARENA.width * dpr;
    canvas.height = ARENA.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return () => {
      cancelAnimationFrame(rafRef.current);
      watcherRef.current?.destroy();
      watcherRef.current = null;
    };
  }, []);

  /**
   * The only render path for objects. During marking/feedback the opts flags
   * add rings, but in the motion and selection phases every object is drawn
   * by the identical unconditional code — target status never reaches the
   * canvas output once marking ends.
   */
  function draw(round: Round, opts: DrawOptions = {}) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ARENA.width, ARENA.height);

    round.objects.forEach((o, i) => {
      ctx.beginPath();
      ctx.arc(o.x, o.y, OBJECT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#666666";
      ctx.fill();

      const isTargetRing =
        (opts.markTargets || opts.revealTargets) &&
        round.targetIndices.includes(i);
      if (isTargetRing) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, OBJECT_RADIUS + 5, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#cc2222";
        ctx.stroke();
      }
      if (opts.selected?.has(i)) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, OBJECT_RADIUS - 6, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#2266cc";
        ctx.stroke();
      }
    });
  }

  /**
   * Marking + motion as one requestAnimationFrame loop. All timestamps are
   * performance.now() taken inside rAF callbacks; the K-scaled mark window
   * and the 6s motion window are measured in real frame time, and the
   * highlight rings vanish in the same frame that motion starts — there is
   * never a frame where targets look different while already moving.
   *
   * Resolves with the measured window durations (frame boundaries land past
   * the nominal windows), which are saved with the trial so verification
   * can confirm the windows were actually honored on screen.
   */
  function runMarkAndMotion(
    round: Round
  ): Promise<{ markMsMeasured: number; motionMsMeasured: number }> {
    return new Promise((resolve) => {
      const markWindow = markMs(round.k);
      let markOnset: number | null = null;
      let motionOnset: number | null = null;
      let lastFrame = 0;

      const frame = () => {
        const now = performance.now();

        if (markOnset === null) {
          markOnset = now;
          draw(round, { markTargets: true });
          rafRef.current = requestAnimationFrame(frame);
          return;
        }

        if (motionOnset === null) {
          if (now - markOnset < markWindow) {
            rafRef.current = requestAnimationFrame(frame);
            return;
          }
          motionOnset = now;
          lastFrame = now;
          transition("motion");
          // Falls through: dt is 0 on this frame, so the objects are redrawn
          // in place without rings before motion begins next frame.
        }

        stepPhysics(round.objects, (now - lastFrame) / 1000, ARENA, OBJECT_RADIUS);
        lastFrame = now;
        draw(round);

        if (now - motionOnset >= MOTION_MS) {
          resolve({
            markMsMeasured: motionOnset - markOnset,
            motionMsMeasured: now - motionOnset,
          });
          return;
        }
        rafRef.current = requestAnimationFrame(frame);
      };

      rafRef.current = requestAnimationFrame(frame);
    });
  }

  function waitForConfirm(): Promise<number[]> {
    return new Promise((resolve) => {
      confirmRef.current = () => {
        confirmRef.current = null;
        resolve([...selectedRef.current].sort((a, b) => a - b));
      };
    });
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== "select") return;
    const canvas = canvasRef.current;
    const round = roundRef.current;
    if (!canvas || !round) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ARENA.width;
    const y = ((e.clientY - rect.top) / rect.height) * ARENA.height;

    let nearest = -1;
    let nearestDist = Infinity;
    round.objects.forEach((o, i) => {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    if (nearest === -1 || nearestDist > OBJECT_RADIUS + HIT_PAD_PX) return;

    const selected = selectedRef.current;
    if (selected.has(nearest)) {
      selected.delete(nearest);
    } else if (selected.size < round.k) {
      selected.add(nearest);
    } else {
      return; // already holding K picks — deselect one first
    }
    setSelectedCount(selected.size);
    draw(round, { selected });
  }

  async function runGame() {
    if (runningRef.current) return;
    runningRef.current = true;
    setRounds([]);
    setEndReason(null);
    setSaveFailures(0);
    setFatalError(null);
    setSelectedCount(0);
    setStatusLine("");

    const watcher = createVisibilityWatcher();
    watcherRef.current = watcher;
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedRound[] = [];
    let reason: EndReason | null = null;

    try {
      const sessionId = await ensureSession();
      let esc: EscalationState = { k: startK, consecutiveDiscards: 0 };

      for (let roundIndex = 0; ; roundIndex++) {
        const round = createRound(esc.k);
        roundRef.current = round;
        selectedRef.current = new Set();
        setSelectedCount(0);
        setRoundK(round.k);
        setStatusLine(`Round ${roundIndex + 1} — track ${round.k} targets`);

        watcher.reset();
        transition("marking");
        const measured = await runMarkAndMotion(round);
        transition("select");
        const selectedIndices = await waitForConfirm();

        const discarded = watcher.compromised;
        const targetSet = new Set(round.targetIndices);
        const correctCount = selectedIndices.filter((i) =>
          targetSet.has(i)
        ).length;
        const correct = correctCount === round.k;

        const record: CompletedRound = {
          roundIndex,
          k: round.k,
          targetIndices: round.targetIndices,
          selectedIndices,
          correctCount,
          accuracy: correctCount / round.k,
          correct,
          discarded,
        };
        completed.push(record);

        savePromises.push(
          saveTrial({
            session_id: sessionId,
            run_id: runId,
            game: GAME,
            trial_index: roundIndex,
            stimulus: {
              k: round.k,
              num_objects: round.objects.length,
              target_indices: round.targetIndices,
              mark_ms: markMs(round.k),
              motion_ms: MOTION_MS,
              mark_ms_measured: Math.round(measured.markMsMeasured),
              motion_ms_measured: Math.round(measured.motionMsMeasured),
            },
            response: {
              selected_indices: selectedIndices,
              correct_count: correctCount,
              accuracy: record.accuracy,
            },
            rt_ms: null, // selection is deliberately untimed
            correct,
            discarded,
            is_practice: isPractice,
          })
            .then(() => true)
            .catch(() => false)
        );

        transition("feedback");
        setStatusLine(
          discarded
            ? "Round interrupted (tab lost focus) — it won't count."
            : `Locked ${correctCount} of ${round.k}`
        );
        draw(round, { revealTargets: true, selected: selectedRef.current });

        await sleep(FEEDBACK_MS);

        // Practice is a single warm-up round: no escalation, no retry loop —
        // one round and done, whatever the outcome.
        if (isPractice) break;

        const result = nextEscalation(esc, { correct, discarded });
        if (result.done) {
          reason = result.reason;
          break;
        }
        esc = result.next;
      }

      const saved = await Promise.all(savePromises);
      setSaveFailures(saved.filter((ok) => !ok).length);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : String(err));
    } finally {
      setRounds(completed);
      setEndReason(reason);
      transition("done");
      watcher.destroy();
      watcherRef.current = null;
      runningRef.current = false;
    }
  }

  const validRounds = rounds.filter((r) => !r.discarded);
  const passedKs = validRounds.filter((r) => r.correct).map((r) => r.k);
  const maxKPassed = passedKs.length > 0 ? Math.max(...passedKs) : null;

  const endReasonLabel =
    endReason === "miss"
      ? "Ended on a missed round."
      : endReason === "cap"
        ? "Cleared the highest level."
        : endReason === "discards"
          ? `Ended after ${MAX_CONSECUTIVE_DISCARDS} interrupted rounds — keep the tab focused to get a score.`
          : null;

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-6">
      <h1>Lock-On{isPractice ? " — Practice (not scored)" : ""}</h1>
      <p data-testid="status">{statusLine}</p>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          maxWidth: ARENA.width,
          // Hit-testing scales x and y independently against the arena, so
          // the on-screen shape must always match the arena's proportions.
          aspectRatio: `${ARENA.width} / ${ARENA.height}`,
          touchAction: "none",
          border: "1px solid #999",
        }}
      />

      {phase === "idle" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p>
            {numObjects(startK)} dots appear; {startK} are marked. When the
            marks vanish and the dots scatter, keep tracking them. When motion
            stops, tap the ones that were marked.
            {isPractice
              ? " One warm-up round."
              : " Each level adds more targets — and more dots."}
          </p>
          <button onClick={runGame}>
            {isPractice ? "Start practice" : "Start"}
          </button>
        </div>
      )}

      {phase === "select" && (
        <div className="flex flex-col items-center gap-2">
          <p>
            Tap the {roundK} targets — {selectedCount} of {roundK} selected
          </p>
          <button
            disabled={selectedCount !== roundK}
            onClick={() => confirmRef.current?.()}
          >
            Confirm
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2>{isPractice ? "Practice complete" : "Done"}</h2>
          {fatalError && <p>Error: {fatalError}</p>}
          {endReasonLabel && <p>{endReasonLabel}</p>}
          {!isPractice && (
            <p>
              Highest level passed:{" "}
              {maxKPassed !== null ? `${maxKPassed} targets` : "—"}
            </p>
          )}
          <ol>
            {rounds.map((r) => (
              <li key={r.roundIndex}>
                Round {r.roundIndex + 1}: K={r.k} · {r.correctCount}/{r.k}{" "}
                correct{r.discarded ? " · discarded" : ""}
              </li>
            ))}
          </ol>
          <p>Save failures: {saveFailures}</p>
          {onComplete ? (
            <button onClick={onComplete}>
              {isPractice ? "Start the real round" : "Continue"}
            </button>
          ) : (
            <button onClick={runGame}>Run again</button>
          )}
        </div>
      )}
    </main>
  );
}
