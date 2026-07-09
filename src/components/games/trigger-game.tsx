"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
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
import {
  getPersonalBest,
  getPersonalBestServerSnapshot,
  recordIfBest,
  subscribePersonalBest,
} from "@/lib/trigger/personal-best";
import { useMotionPreference } from "@/lib/hooks/use-motion-preference";
import { Button } from "@/components/ui/button";
import { ReflexGauge, type GaugeStatus } from "@/components/trigger/reflex-gauge";
import { ReducedMotionToggle } from "@/components/lab/reduced-motion-toggle";
import type { GameProps } from "@/components/games/types";

// Trigger skeleton: 20–30 trials.
const TRIAL_COUNT = 25;
// Practice: same mechanics through the same trial loop, just fewer trials.
const PRACTICE_TRIAL_COUNT = 3;
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

export function TriggerGame({
  mode = "scored",
  runId = null,
  onComplete,
}: GameProps) {
  const isPractice = mode === "practice";
  const trialCount = isPractice ? PRACTICE_TRIAL_COUNT : TRIAL_COUNT;

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [trialLabel, setTrialLabel] = useState("");
  const [trials, setTrials] = useState<CompletedTrial[]>([]);
  const [liveTrial, setLiveTrial] = useState<CompletedTrial | null>(null);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reducedMotion, toggleReducedMotion] = useMotionPreference();
  const personalBest = useSyncExternalStore(
    subscribePersonalBest,
    getPersonalBest,
    getPersonalBestServerSnapshot
  );
  const targetRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  // Display-only: updates the on-screen personal best whenever a valid trial
  // completes. Does not affect what was already saved to Supabase. Practice
  // trials never set a PB.
  useEffect(() => {
    if (isPractice) return;
    if (!liveTrial) return;
    if (liveTrial.correct && !liveTrial.discarded && liveTrial.rtMs !== null) {
      recordIfBest(liveTrial.rtMs);
    }
  }, [liveTrial, isPractice]);

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

      for (let i = 0; i < trialCount; i++) {
        setTrialLabel(`Trial ${i + 1} of ${trialCount}`);
        const trial = await runTrial(i, watcher, setLiveTrial);
        completed.push(trial);
        savePromises.push(
          saveTrial({
            session_id: sessionId,
            run_id: runId,
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
            is_practice: isPractice,
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
    watcher: VisibilityWatcher,
    onResult: (trial: CompletedTrial) => void
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
      const trial: CompletedTrial = {
        trialIndex,
        foreperiodMs,
        response: raceResult,
        rtMs: null,
        correct: false,
        discarded: watcher.compromised,
      };
      onResult(trial);
      await sleep(800);
      return trial;
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
      const trial: CompletedTrial = {
        trialIndex,
        foreperiodMs,
        response: null,
        rtMs: null,
        correct: false,
        discarded: watcher.compromised,
      };
      onResult(trial);
      await sleep(800);
      return trial;
    }

    const rtMs = measuredRt;
    setMessage(`${Math.round(rtMs)} ms`);
    const trial: CompletedTrial = {
      trialIndex,
      foreperiodMs,
      response,
      rtMs,
      correct: true,
      discarded: watcher.compromised,
    };
    onResult(trial);
    await sleep(600);

    return trial;
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

  const gaugeStatus: GaugeStatus = !liveTrial
    ? "idle"
    : liveTrial.rtMs !== null
      ? "hit"
      : liveTrial.response !== null
        ? "false-start"
        : "miss";

  return (
    <div className="lab flex min-h-screen flex-col items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-md items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Cognitive Performance Lab
        </span>
        <div className="flex items-center gap-3">
          {!isPractice && personalBest !== null && (
            <motion.span
              key={personalBest}
              initial={reducedMotion ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[11px] uppercase tracking-widest text-primary"
            >
              PB {Math.round(personalBest)} ms
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
        className="mt-10 flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-border bg-card px-8 py-10 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-3xl font-semibold uppercase tracking-[0.2em]">
            Trigger
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {isPractice ? "Practice — not scored" : "Reflex Console"}
          </p>
        </div>

        {phase === "running" && (
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {trialLabel}
          </span>
        )}

        <ReflexGauge
          rtMs={liveTrial?.rtMs ?? null}
          status={gaugeStatus}
          reducedMotion={reducedMotion}
        />

        <p className="min-h-[1.25rem] font-mono text-sm uppercase tracking-widest text-foreground">
          {phase === "running" ? message : ""}
        </p>

        <div
          ref={targetRef}
          data-target
          className="h-36 w-36 rounded-full"
          style={{
            visibility: "hidden",
            transition: "none",
            background:
              "radial-gradient(circle at 35% 35%, #93c5fd, var(--primary) 55%, #1d4ed8 100%)",
            boxShadow:
              "0 0 70px 14px color-mix(in srgb, var(--primary) 55%, transparent)",
          }}
        />

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              When the signal lights up, tap or press any key as fast as you
              can. {trialCount} trials.
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
            className="flex w-full flex-col items-center gap-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {isPractice ? "Practice Complete" : "Session Complete"}
            </h2>
            {fatalError && (
              <p className="text-sm text-destructive">Error: {fatalError}</p>
            )}
            <div className="grid w-full grid-cols-2 gap-3">
              <StatBox
                label="Valid"
                value={`${validTrials.length} / ${trials.length}`}
              />
              <StatBox
                label="Mean"
                value={meanRt !== null ? `${Math.round(meanRt)} ms` : "—"}
              />
              <StatBox
                label="Median"
                value={medianRt !== null ? `${Math.round(medianRt)} ms` : "—"}
              />
              <StatBox
                label="Errors"
                value={`${
                  trials.filter((t) => !t.correct && t.response !== null)
                    .length
                } FS · ${
                  trials.filter((t) => !t.correct && t.response === null)
                    .length
                } miss`}
              />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Discarded: {trials.filter((t) => t.discarded).length} · Save
              failures: {saveFailures}
            </p>
            <details className="w-full">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Per-trial log
              </summary>
              <ol className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                {trials.map((t) => (
                  <li key={t.trialIndex}>
                    {String(t.trialIndex + 1).padStart(2, "0")} ·{" "}
                    {t.rtMs !== null
                      ? `${Math.round(t.rtMs)} ms`
                      : t.response !== null
                        ? "false start"
                        : "miss"}
                    {t.discarded ? " (discarded)" : ""}
                  </li>
                ))}
              </ol>
            </details>
            {onComplete ? (
              <Button size="lg" onClick={onComplete}>
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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
