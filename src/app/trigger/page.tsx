"use client";

import { useRef, useState } from "react";
import { ensureSession } from "@/lib/supabase/session";
import {
  awaitResponse,
  createVisibilityWatcher,
  randomForeperiod,
  showStimulusAtNextFrame,
  sleep,
  type CapturedResponse,
  type VisibilityWatcher,
} from "@/lib/engine/measurement";
import { saveTrial } from "@/lib/engine/save-trials";

// Trigger skeleton: 20–30 trials.
const TRIAL_COUNT = 25;
const FOREPERIOD_MIN_MS = 1000;
const FOREPERIOD_MAX_MS = 3000;
const RESPONSE_DEADLINE_MS = 2500;
const GAME = "trigger";

type CompletedTrial = {
  trialIndex: number;
  foreperiodMs: number;
  response: CapturedResponse | null; // null = no response before the deadline (miss)
  rtMs: number | null;
  correct: boolean;
  discarded: boolean;
};

type Phase = "idle" | "running" | "done";

export default function TriggerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [trialLabel, setTrialLabel] = useState("");
  const [trials, setTrials] = useState<CompletedTrial[]>([]);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  async function runTask() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("running");
    setTrials([]);
    setSaveFailures(0);
    setFatalError(null);

    const watcher = createVisibilityWatcher();
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedTrial[] = [];

    try {
      const sessionId = await ensureSession();

      for (let i = 0; i < TRIAL_COUNT; i++) {
        setTrialLabel(`Trial ${i + 1} of ${TRIAL_COUNT}`);
        const trial = await runTrial(i, watcher);
        completed.push(trial);
        savePromises.push(
          saveTrial({
            session_id: sessionId,
            game: GAME,
            trial_index: trial.trialIndex,
            stimulus: { foreperiod_ms: trial.foreperiodMs },
            response: trial.response
              ? {
                  type: trial.response.type,
                  ...(trial.response.key !== undefined
                    ? { key: trial.response.key }
                    : {}),
                }
              : null,
            rt_ms: trial.rtMs,
            correct: trial.correct,
            discarded: trial.discarded,
          })
            .then(() => true)
            .catch(() => false)
        );
      }

      const saved = await Promise.all(savePromises);
      setSaveFailures(saved.filter((ok) => !ok).length);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : String(err));
    } finally {
      setTrials(completed);
      setPhase("done");
      watcher.destroy();
      runningRef.current = false;
    }
  }

  async function runTrial(
    trialIndex: number,
    watcher: VisibilityWatcher
  ): Promise<CompletedTrial> {
    const target = targetRef.current;
    if (!target) throw new Error("Stimulus element missing.");

    target.style.visibility = "hidden";
    watcher.reset();
    setMessage("Wait for the target…");

    const foreperiodMs = randomForeperiod(FOREPERIOD_MIN_MS, FOREPERIOD_MAX_MS);
    const responder = awaitResponse();

    const raceResult = await Promise.race([
      responder.promise,
      sleep(foreperiodMs).then(() => "foreperiod-elapsed" as const),
    ]);

    if (raceResult !== "foreperiod-elapsed") {
      // Responded before the stimulus appeared: false start, no RT.
      setMessage("Too soon!");
      await sleep(800);
      return {
        trialIndex,
        foreperiodMs,
        response: raceResult,
        rtMs: null,
        correct: false,
        discarded: watcher.compromised,
      };
    }

    const onsetMs = await showStimulusAtNextFrame(target);
    // Invariant: no React state updates between onset and response capture —
    // a re-render would re-apply the hidden style to the stimulus.
    const outcome = await Promise.race([
      responder.promise,
      sleep(RESPONSE_DEADLINE_MS).then(() => "deadline-elapsed" as const),
    ]);
    target.style.visibility = "hidden";

    // Classify by the measurement, not race order: a late-firing deadline
    // timer must not let an over-deadline response count as valid.
    const response = outcome === "deadline-elapsed" ? null : outcome;
    const measuredRt =
      response === null ? null : response.timestamp - onsetMs;

    if (
      response === null ||
      measuredRt === null ||
      measuredRt > RESPONSE_DEADLINE_MS
    ) {
      // No response within the deadline: miss, no RT.
      responder.cancel();
      setMessage("Too slow!");
      await sleep(800);
      return {
        trialIndex,
        foreperiodMs,
        response: null,
        rtMs: null,
        correct: false,
        discarded: watcher.compromised,
      };
    }

    const rtMs = measuredRt;
    setMessage(`${Math.round(rtMs)} ms`);
    await sleep(600);

    return {
      trialIndex,
      foreperiodMs,
      response,
      rtMs,
      correct: true,
      discarded: watcher.compromised,
    };
  }

  const validTrials = trials.filter(
    (t) => t.correct && !t.discarded && t.rtMs !== null
  );
  const validRts = validTrials.map((t) => t.rtMs as number);
  const meanRt =
    validRts.length > 0
      ? validRts.reduce((sum, rt) => sum + rt, 0) / validRts.length
      : null;
  const medianRt = validRts.length > 0 ? median(validRts) : null;

  return (
    <main style={{ padding: 24 }}>
      <h1>Trigger — reaction time</h1>

      {phase === "idle" && (
        <>
          <p>
            When the box appears, tap or press any key as fast as you can.{" "}
            {TRIAL_COUNT} trials.
          </p>
          <button onClick={runTask}>Start</button>
        </>
      )}

      {phase === "running" && (
        <>
          <p>{trialLabel}</p>
          <p>{message}</p>
        </>
      )}

      <div
        ref={targetRef}
        data-target
        style={{
          width: 160,
          height: 160,
          background: "red",
          visibility: "hidden",
          marginTop: 16,
        }}
      />

      {phase === "done" && (
        <>
          <h2>Summary</h2>
          {fatalError && <p>Error: {fatalError}</p>}
          <p>
            Valid trials: {validTrials.length} / {trials.length}
            {meanRt !== null && <> · mean {Math.round(meanRt)} ms</>}
            {medianRt !== null && <> · median {Math.round(medianRt)} ms</>}
          </p>
          <p>
            False starts:{" "}
            {trials.filter((t) => !t.correct && t.response !== null).length} ·
            Misses:{" "}
            {trials.filter((t) => !t.correct && t.response === null).length} ·
            Discarded (tab hidden):{" "}
            {trials.filter((t) => t.discarded).length} · Save failures:{" "}
            {saveFailures}
          </p>
          <ol start={1}>
            {trials.map((t) => (
              <li key={t.trialIndex}>
                {t.rtMs !== null
                  ? `${Math.round(t.rtMs)} ms`
                  : t.response !== null
                    ? "false start"
                    : "miss (no response)"}
                {t.discarded ? " (discarded — tab hidden)" : ""}
              </li>
            ))}
          </ol>
          <button onClick={runTask}>Run again</button>
        </>
      )}
    </main>
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
