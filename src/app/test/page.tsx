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
 * Flow/state pass only — the visual skin comes later (Phase 4), and the
 * results screen (Phase 3.3) will replace the plain complete screen.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TriggerGame } from "@/components/games/trigger-game";
import { GatekeeperGame } from "@/components/games/gatekeeper-game";
import { EchoGame } from "@/components/games/echo-game";
import { CircuitGame } from "@/components/games/circuit-game";
import { LockOnGame } from "@/components/games/lockon-game";
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

export default function TestPage() {
  const [runId, setRunId] = useState<string | null>(null);
  // -1 = intro, 0..TOTAL_STEPS-1 = game steps, TOTAL_STEPS = complete.
  const [step, setStep] = useState(-1);

  function startRun() {
    setRunId(crypto.randomUUID());
    setStep(0);
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
        <Button size="lg" onClick={startRun}>
          Begin
        </Button>
      </main>
    );
  }

  if (step >= TOTAL_STEPS) {
    return (
      <main className="lab flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
        <SequenceProgress step={step} />
        <h1 className="text-3xl font-semibold tracking-tight">
          Sequence complete
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          All five games are recorded. Your results screen is coming in the
          next build phase — for now this run is safely stored.
        </p>
        <Button size="lg" onClick={startRun}>
          Start a new run
        </Button>
      </main>
    );
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
        onComplete={() => setStep((s) => s + 1)}
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
