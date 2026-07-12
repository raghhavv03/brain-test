"use client";

/**
 * The "[BRAND] Cognitive Performance Lab" sequence wrapper (Phase 3.1).
 *
 * Flow: intro → (practice → scored) × 5 games → complete. One client-minted
 * run_id (crypto.randomUUID) is stamped on every trial of the run, so a
 * retake in the same browser can never mix trials with an earlier attempt.
 * Policy: no per-game redo — only a full restart, which mints a fresh
 * run_id. A page refresh mid-run loses the in-memory flow state and restarts
 * as a new run; the abandoned partial run stays in the table under its own
 * run_id and is simply never scored.
 *
 * Session-integrity gate (July 2026 production incident — see
 * docs/project-reference.md, src/lib/supabase/session.ts): the intro screen
 * verifies a write-capable session before "Begin" is enabled, and every step
 * completion is checked for save failures. A pre-run desync self-heals
 * silently (safe: nothing has saved yet). A mid-run desync halts the run and
 * requires a full restart through the same validated intro gate, exactly
 * like any other abandoned run above — session_id must never change once a
 * trial has saved under the active run_id (fetchRunTrials's exact-pair
 * filter has no way to recover a run split across two identities).
 *
 * Flow/state pass only — the visual skin comes later (Phase 4). The complete
 * step renders the Phase 3.3 results screen.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResultsScreen } from "@/components/results/results-screen";
import { TriggerGame } from "@/components/games/trigger-game";
import { GatekeeperGame } from "@/components/games/gatekeeper-game";
import { EchoGame } from "@/components/games/echo-game";
import { CircuitGame } from "@/components/games/circuit-game";
import { LockOnGame } from "@/components/games/lockon-game";
import { ensureSession, resetSession, setRunActive } from "@/lib/supabase/session";
import type { GameProps } from "@/components/games/types";

const GAMES: {
  key: string;
  label: string;
  measures: string;
  Component: (props: GameProps) => React.ReactNode;
}[] = [
  { key: "trigger", label: "Trigger", measures: "Processing speed", Component: TriggerGame },
  { key: "gatekeeper", label: "Gatekeeper", measures: "Impulse control", Component: GatekeeperGame },
  { key: "echo", label: "Echo", measures: "Working memory", Component: EchoGame },
  { key: "circuit", label: "Circuit", measures: "Task switching", Component: CircuitGame },
  { key: "lockon", label: "Lock-On", measures: "Divided attention", Component: LockOnGame },
];

// Two steps per game: practice (even), scored (odd).
const TOTAL_STEPS = GAMES.length * 2;

type SessionState = "checking" | "ready" | "blocked";
type HaltInfo = { saveFailures: number; fatalError: string | null };

export default function TestPage() {
  const [runId, setRunId] = useState<string | null>(null);
  // -1 = intro, 0..TOTAL_STEPS-1 = game steps, TOTAL_STEPS = complete.
  const [step, setStep] = useState(-1);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [haltInfo, setHaltInfo] = useState<HaltInfo | null>(null);

  // Pre-run only (see the module-level comment on runActive in session.ts):
  // verifies ensureSession() actually resolves before "Begin" is enabled.
  const checkSession = useCallback(async () => {
    setSessionState("checking");
    try {
      await ensureSession();
      setSessionState("ready");
    } catch {
      setSessionState("blocked");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  function startRun() {
    setHaltInfo(null);
    setRunActive(true);
    setRunId(crypto.randomUUID());
    setStep(0);
  }

  // Called by each game's onComplete with this step's save outcome. A clean
  // step advances as before; a step with any save failure halts instead of
  // silently proceeding into a corrupted or partial run. Reaching the
  // results step ends the run — runActive resets here so a desync detected
  // while viewing results (or before a later retake) can self-heal again,
  // instead of runActive staying stuck true for the rest of the tab's life.
  function handleStepComplete(info?: HaltInfo) {
    if (info && (info.saveFailures > 0 || info.fatalError)) {
      setHaltInfo(info);
      return;
    }
    if (step + 1 >= TOTAL_STEPS) setRunActive(false);
    setStep((s) => s + 1);
  }

  // The only sanctioned recovery from a mid-run halt: abandon this run_id
  // (it stays orphaned in trials, exactly like a reload-abandoned run — see
  // the file-level comment) and return to the validated intro gate.
  // resetSession() is essential here, not optional: the desync event that
  // caused this halt was deliberately dropped by onAuthStateChange while the
  // run was active (see session.ts), so it never gets "replayed" just
  // because runActive flips back to false — without forcing a fresh
  // ensureSession() re-derivation, checkSession() would just hand back the
  // same stale, broken identity and this halt would recur indefinitely.
  function restartFromHalt() {
    setHaltInfo(null);
    setRunActive(false);
    resetSession();
    setStep(-1);
    void checkSession();
  }

  if (haltInfo) {
    return (
      <main className="lab flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
        <p className="font-mono text-[11px] uppercase tracking-widest text-destructive">
          Session interrupted
        </p>
        <h1 className="max-w-md text-2xl font-semibold tracking-tight">
          This round didn&apos;t save correctly
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your browser lost its connection to your session, so
          {haltInfo.saveFailures > 0
            ? ` ${haltInfo.saveFailures} result${haltInfo.saveFailures === 1 ? "" : "s"} from this round didn't save.`
            : " part of this round didn't save."}{" "}
          To keep your results accurate, restarting is the only way to
          guarantee clean data for scoring — this attempt won&apos;t be
          scored.
        </p>
        <Button size="lg" onClick={restartFromHalt}>
          Restart
        </Button>
      </main>
    );
  }

  if (step === -1) {
    return (
      <main className="lab flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          [BRAND] Cognitive Performance Lab
        </p>
        <h1 className="max-w-md text-3xl font-semibold tracking-tight">
          Five short games. One honest brain score.
        </h1>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {GAMES.map((g, i) => (
            <li key={g.key}>
              {i + 1}. {g.label} — {g.measures}
            </li>
          ))}
        </ul>
        <div className="max-w-sm space-y-2 text-sm text-muted-foreground">
          <p>
            Each game starts with a short unscored practice round. The whole
            sequence takes about 10 minutes.
          </p>
          <p>
            Stay in this tab — trials where the tab loses focus are discarded
            and can&apos;t be scored.
          </p>
          <p className="text-xs">
            This is a performance exercise, not a medical test.
          </p>
        </div>
        {sessionState === "ready" && (
          <Button size="lg" onClick={startRun}>
            Begin
          </Button>
        )}
        {sessionState === "checking" && (
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Confirming your session…
          </p>
        )}
        {sessionState === "blocked" && (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-xs text-sm text-destructive">
              We couldn&apos;t confirm your session. This can happen after
              the browser reclaims memory in the background.
            </p>
            <Button size="lg" onClick={checkSession}>
              Retry
            </Button>
          </div>
        )}
      </main>
    );
  }

  if (step >= TOTAL_STEPS) {
    // runId is always set once past the intro; the guard is for the type system.
    return runId ? <ResultsScreen runId={runId} onRestart={startRun} /> : null;
  }

  const gameIndex = Math.floor(step / 2);
  const isPracticeStep = step % 2 === 0;
  const { Component } = GAMES[gameIndex];

  return (
    <div className="lab flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-col items-center px-6 pt-6">
        <SequenceProgress step={step} />
      </div>
      {/* key remounts the game fresh for each step (practice vs scored). */}
      <Component
        key={step}
        mode={isPracticeStep ? "practice" : "scored"}
        runId={runId}
        onComplete={handleStepComplete}
      />
    </div>
  );
}

function SequenceProgress({ step }: { step: number }) {
  const gameIndex = Math.min(Math.floor(step / 2), GAMES.length - 1);
  const isPracticeStep = step % 2 === 0;
  const complete = step >= TOTAL_STEPS;

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between">
        {GAMES.map((g, i) => (
          <span
            key={g.key}
            className={`font-mono text-[10px] uppercase tracking-widest ${
              complete || i < gameIndex
                ? "text-primary"
                : i === gameIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {g.label}
          </span>
        ))}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100}%` }}
        />
      </div>
      {!complete && (
        <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Game {gameIndex + 1} of {GAMES.length} ·{" "}
          {isPracticeStep ? "Practice" : "Scored round"}
        </p>
      )}
    </div>
  );
}
