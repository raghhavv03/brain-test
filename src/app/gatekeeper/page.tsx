"use client";

import { useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";

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
    setMessage("");

    const watcher = createVisibilityWatcher();
    const sequence = generateTrialSequence();
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedTrial[] = [];

    try {
      const sessionId = await ensureSession();

      for (let i = 0; i < sequence.length; i++) {
        setTrialLabel(`Trial ${i + 1} of ${sequence.length}`);
        const trial = await runTrial(i, sequence[i], watcher);
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
    watcher: VisibilityWatcher
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
      setMessage(correct ? `${Math.round(rtMs as number)} ms` : "Missed!");
    } else {
      setMessage(correct ? "Held." : "Commission error!");
    }

    return {
      trialIndex,
      stimulusType,
      response,
      rtMs,
      correct,
      discarded: watcher.compromised,
    };
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

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <h1 className="text-2xl font-semibold">Gatekeeper</h1>
      <p className="mt-1 text-sm text-muted-foreground">Go / No-Go</p>

      {phase === "running" && (
        <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
          {trialLabel}
        </p>
      )}

      <div
        ref={targetRef}
        data-target
        className="mt-8 flex h-36 w-36 items-center justify-center rounded-full border border-border text-xl font-bold"
        style={{ visibility: "hidden", transition: "none" }}
      >
        {stimulusLabel}
      </div>

      <p className="mt-4 min-h-[1.25rem] text-sm">
        {phase === "running" ? message : ""}
      </p>

      {phase === "idle" && (
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <p className="max-w-xs text-sm text-muted-foreground">
            Tap or press space on GO. Do nothing on NO-GO. {TOTAL_TRIALS}{" "}
            trials.
          </p>
          <Button size="lg" onClick={runTask}>
            Start
          </Button>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-6 flex w-full max-w-md flex-col items-center gap-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Session Complete
          </h2>
          {fatalError && (
            <p className="text-sm text-destructive">Error: {fatalError}</p>
          )}
          <div className="grid w-full grid-cols-2 gap-3">
            <StatBox label="Go hits" value={`${hits.length} / ${goTrials.length}`} />
            <StatBox label="Omissions" value={`${omissions.length}`} />
            <StatBox
              label="Correct rejections"
              value={`${correctRejections.length} / ${noGoTrials.length}`}
            />
            <StatBox
              label="Commission errors"
              value={`${commissionErrors.length}`}
            />
            <StatBox
              label="Mean go RT"
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
            <summary className="cursor-pointer text-[11px] uppercase tracking-widest text-muted-foreground">
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
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
