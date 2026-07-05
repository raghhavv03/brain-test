"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ensureSession } from "@/lib/supabase/session";
import {
  awaitResponse,
  createVisibilityWatcher,
  showStimulusAtNextFrame,
  sleep,
  type CapturedResponse,
  type VisibilityWatcher,
} from "@/lib/engine/measurement";
import { saveTrial } from "@/lib/engine/save-trials";
import {
  generateTrialSequence,
  TOTAL_TRIALS,
  type StimulusType,
} from "@/lib/gatekeeper/trial-sequence";
import { useMotionPreference } from "@/lib/hooks/use-motion-preference";
import { Button } from "@/components/ui/button";
import { GateSignal } from "@/components/gatekeeper/gate-signal";
import { BreachFlash } from "@/components/gatekeeper/breach-flash";
import { ReducedMotionToggle } from "@/components/lab/reduced-motion-toggle";

// Gatekeeper skeleton: fixed 500ms ISI, 600ms response window.
const ISI_MS = 500;
const RESPONSE_WINDOW_MS = 600;
const GAME = "gatekeeper";

type CompletedTrial = {
  trialIndex: number;
  stimulusType: StimulusType;
  response: CapturedResponse | null;
  rtMs: number | null;
  correct: boolean;
  discarded: boolean;
};

type Phase = "idle" | "running" | "done";

export default function GatekeeperPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [trialLabel, setTrialLabel] = useState("");
  const [stimulusLabel, setStimulusLabel] = useState("");
  const [trials, setTrials] = useState<CompletedTrial[]>([]);
  const [streak, setStreak] = useState(0);
  const [breachTick, setBreachTick] = useState(0);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reducedMotion, toggleReducedMotion] = useMotionPreference();
  const targetRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  // Display-only: derives the live streak/breach HUD from each completed
  // trial as it comes in. Does not affect classification or what was saved.
  function handleTrialResult(trial: CompletedTrial) {
    setStreak((prev) => (trial.correct ? prev + 1 : 0));
    if (trial.stimulusType === "no-go" && !trial.correct) {
      setBreachTick((prev) => prev + 1);
    }
  }

  async function runTask() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("running");
    setTrials([]);
    setStreak(0);
    setBreachTick(0);
    setSaveFailures(0);
    setFatalError(null);
    setMessage("");

    const watcher = createVisibilityWatcher();
    const sequence = generateTrialSequence();
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedTrial[] = [];

    try {
      const sessionId = await ensureSession();

      for (let i = 0; i < sequence.length; i++) {
        setTrialLabel(`Signal ${i + 1} of ${sequence.length}`);
        const trial = await runTrial(i, sequence[i], watcher, handleTrialResult);
        completed.push(trial);
        savePromises.push(
          saveTrial({
            session_id: sessionId,
            game: GAME,
            trial_index: trial.trialIndex,
            stimulus: { type: trial.stimulusType },
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
    stimulusType: StimulusType,
    watcher: VisibilityWatcher,
    onResult: (trial: CompletedTrial) => void
  ): Promise<CompletedTrial> {
    const target = targetRef.current;
    if (!target) throw new Error("Stimulus element missing.");

    target.style.visibility = "hidden";
    watcher.reset();
    setStimulusLabel("");
    await sleep(ISI_MS);

    setStimulusLabel(stimulusType === "go" ? "GO" : "NO-GO");
    const responder = awaitResponse();
    const onsetMs = await showStimulusAtNextFrame(target);
    // Invariant: no React state updates between onset and response capture —
    // a re-render would re-apply the hidden style to the stimulus.
    const outcome = await Promise.race([
      responder.promise,
      sleep(RESPONSE_WINDOW_MS).then(() => "deadline-elapsed" as const),
    ]);
    target.style.visibility = "hidden";

    // Classify by the measurement, not race order: a late-firing window timer
    // must not let an over-window response count as valid (same boundary
    // guard as Trigger's response deadline).
    const rawResponse = outcome === "deadline-elapsed" ? null : outcome;
    const measuredRt =
      rawResponse === null ? null : rawResponse.timestamp - onsetMs;
    const withinWindow = measuredRt !== null && measuredRt <= RESPONSE_WINDOW_MS;
    if (!withinWindow) responder.cancel();
    const response = withinWindow ? rawResponse : null;
    const rtMs = withinWindow ? measuredRt : null;

    // Go: correct = responded in time. No-go: correct = withheld.
    // rt_ms is captured on both go hits and no-go commission errors.
    const correct = stimulusType === "go" ? response !== null : response === null;

    if (stimulusType === "go") {
      setMessage(correct ? `${Math.round(rtMs as number)} ms` : "MISSED");
    } else {
      setMessage(correct ? "HELD" : "BREACH!");
    }

    const trial: CompletedTrial = {
      trialIndex,
      stimulusType,
      response,
      rtMs,
      correct,
      discarded: watcher.compromised,
    };
    onResult(trial);
    return trial;
  }

  const goTrials = trials.filter((t) => t.stimulusType === "go");
  const noGoTrials = trials.filter((t) => t.stimulusType === "no-go");
  const hits = goTrials.filter((t) => t.correct);
  const omissions = goTrials.filter((t) => !t.correct);
  const correctRejections = noGoTrials.filter((t) => t.correct);
  const commissionErrors = noGoTrials.filter((t) => !t.correct);
  const validHitRts = hits
    .filter((t) => !t.discarded && t.rtMs !== null)
    .map((t) => t.rtMs as number);
  const meanHitRt =
    validHitRts.length > 0
      ? validHitRts.reduce((sum, rt) => sum + rt, 0) / validHitRts.length
      : null;

  const messageColor =
    stimulusLabel === "NO-GO"
      ? message === "BREACH!"
        ? "text-destructive"
        : "text-primary"
      : message && message !== "MISSED"
        ? "text-primary"
        : message === "MISSED"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="lab flex min-h-screen flex-col items-center bg-background px-6 py-10 text-foreground">
      <BreachFlash breachTick={breachTick} reducedMotion={reducedMotion} />

      <div className="flex w-full max-w-md items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Cognitive Performance Lab
        </span>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <motion.span
              key={streak}
              initial={reducedMotion ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[11px] uppercase tracking-widest text-primary"
            >
              STREAK {streak}
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
            Gatekeeper
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Authorization Gate
          </p>
        </div>

        {phase === "running" && (
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {trialLabel}
          </span>
        )}

        <div className="pb-4">
          <GateSignal ref={targetRef} stimulusLabel={stimulusLabel} />
        </div>

        <p
          className={`min-h-[1.25rem] font-mono text-sm uppercase tracking-widest ${messageColor}`}
        >
          {phase === "running" ? message : ""}
        </p>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Authorize friendlies — tap or press space. Hold for hostiles —
              do nothing. {TOTAL_TRIALS} signals.
            </p>
            <Button size="lg" onClick={runTask}>
              Start
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
              Session Complete
            </h2>
            {fatalError && (
              <p className="text-sm text-destructive">Error: {fatalError}</p>
            )}
            <div className="grid w-full grid-cols-2 gap-3">
              <StatBox
                label="Authorized"
                value={`${hits.length} / ${goTrials.length}`}
              />
              <StatBox label="Missed" value={`${omissions.length}`} />
              <StatBox
                label="Blocked"
                value={`${correctRejections.length} / ${noGoTrials.length}`}
              />
              <StatBox
                label="Breaches"
                value={`${commissionErrors.length}`}
                emphasize={commissionErrors.length > 0}
              />
              <StatBox
                label="Mean response"
                value={meanHitRt !== null ? `${Math.round(meanHitRt)} ms` : "—"}
              />
              <StatBox
                label="Discarded"
                value={`${trials.filter((t) => t.discarded).length}`}
              />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Save failures: {saveFailures}
            </p>
            <details className="w-full">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Per-trial log
              </summary>
              <ol className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                {trials.map((t) => (
                  <li key={t.trialIndex}>
                    {String(t.trialIndex + 1).padStart(2, "0")} ·{" "}
                    {t.stimulusType} ·{" "}
                    {t.rtMs !== null
                      ? `${Math.round(t.rtMs)} ms`
                      : t.stimulusType === "go"
                        ? "miss"
                        : "held"}
                    {t.discarded ? " (discarded)" : ""}
                  </li>
                ))}
              </ol>
            </details>
            <Button size="lg" onClick={runTask}>
              Run again
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function StatBox({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center ${
        emphasize
          ? "border-destructive/40 bg-destructive/10"
          : "border-border bg-background/40"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-sm ${
          emphasize ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
