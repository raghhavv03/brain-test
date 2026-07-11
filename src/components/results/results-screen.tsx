"use client";

/**
 * Results screen (Phase 3.3, part a) — rendered by the sequence wrapper when
 * a run completes. Fetches the run's scored trials, runs the verified
 * scoring engine, persists the result (idempotent upsert on run_id), and
 * presents it.
 *
 * Tone rules (CLAUDE.md + brand skill): honest and calm. Self-relative
 * language about THIS RUN only; no medical/diagnostic wording, no
 * manufactured deficits, no alarmism. A missing measurement is shown as
 * exactly that — never as a zero or a weakness.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { computeBrainScore } from "@/lib/scoring/brain-score";
import { fetchRunTrials, saveResult } from "@/lib/scoring/session";
import { ensureSession } from "@/lib/supabase/session";
import {
  DOMAIN_KEYS,
  type BrainScoreResult,
  type DomainKey,
} from "@/lib/scoring/types";
import { DomainRadar } from "./domain-radar";
import { EmailCapture } from "./email-capture";
import { pickInsights } from "./insights";
import { DOMAIN_LABELS } from "./labels";
import { ShareButton } from "./share-button";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: BrainScoreResult };

export function ResultsScreen({
  runId,
  onRestart,
}: {
  runId: string;
  onRestart: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [saveFailed, setSaveFailed] = useState(false);
  // One scoring pass per mount cycle — StrictMode runs effects twice; the
  // run_id unique constraint is the backstop for anything past this guard.
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    setSaveFailed(false);
    try {
      const sessionId = await ensureSession();
      const trials = await fetchRunTrials(sessionId, runId);
      const result = computeBrainScore(trials);
      setState({ status: "ready", result });
      try {
        await saveResult(sessionId, runId, result);
      } catch (saveError) {
        console.error("Failed to store result:", saveError);
        setSaveFailed(true);
      }
    } catch (error) {
      console.error("Failed to load run trials:", error);
      setState({
        status: "error",
        message:
          "Your run is safely recorded, but the score couldn't be computed right now.",
      });
    }
  }, [runId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <Shell>
        <p className="animate-pulse font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Scoring your run…
        </p>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&apos;t compute your score
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">{state.message}</p>
        <Button
          size="lg"
          onClick={() => {
            startedRef.current = true;
            void load();
          }}
        >
          Try again
        </Button>
      </Shell>
    );
  }

  return (
    <ResultsView result={state.result} onRestart={onRestart} saveFailed={saveFailed} />
  );
}

/** Presentational half — pure render of an already-computed result. */
export function ResultsView({
  result,
  onRestart,
  saveFailed = false,
}: {
  result: BrainScoreResult;
  onRestart: () => void;
  saveFailed?: boolean;
}) {
  const { headline, domains } = result;
  const insights = pickInsights(domains);

  return (
    <Shell wide>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex w-full flex-col items-center gap-10"
      >
        <header className="flex flex-col items-center gap-1">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            [BRAND] Cognitive Performance Lab
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Your session results
          </h1>
        </header>

        {headline.status === "scored" ? (
          <section className="flex flex-col items-center gap-2" aria-label="Brain score">
            <CountUpScore score={headline.score} />
            <p className="text-lg font-medium text-primary">{headline.band}</p>
            {headline.basedOnDomains < DOMAIN_KEYS.length && (
              <p className="text-xs text-muted-foreground">
                {`Based on ${headline.basedOnDomains} of ${DOMAIN_KEYS.length} areas — the rest didn't produce enough clean data.`}
              </p>
            )}
          </section>
        ) : (
          <section
            className="flex max-w-sm flex-col items-center gap-3 text-center"
            aria-label="No headline score"
          >
            <h2 className="text-2xl font-semibold tracking-tight">
              No headline score this run
            </h2>
            <p className="text-sm text-muted-foreground">{headline.reason}</p>
            <p className="text-sm text-muted-foreground">
              The area-by-area detail below shows what happened. A fresh,
              uninterrupted run is the fix.
            </p>
            <Button size="lg" onClick={onRestart}>
              Run it again
            </Button>
          </section>
        )}

        <DomainRadar domains={domains} />

        <section className="w-full max-w-md" aria-label="Area breakdown">
          <ul className="flex flex-col gap-2">
            {DOMAIN_KEYS.map((key) => (
              <DomainRow key={key} domainKey={key} domain={domains[key]} />
            ))}
          </ul>
        </section>

        <InsightCards insights={insights} />

        <section className="flex flex-col items-center gap-3">
          {/* Placeholder CTA — a later phase wires this to the product site. */}
          <Button size="lg" nativeButton={false} render={<a href="#" />}>
            Learn more about [BRAND]
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            Start a new run
          </Button>
        </section>

        <EmailCapture />

        {headline.status === "scored" && (
          <ShareButton headline={headline} domains={domains} />
        )}

        {saveFailed && (
          <p className="text-xs text-muted-foreground">
            This result couldn&apos;t be stored — the scores above are still
            valid for this session.
          </p>
        )}

        <p className="max-w-sm text-center text-xs text-muted-foreground">
          A self-assessment of one sitting&apos;s performance — not a medical
          test, and scores vary day to day.
        </p>
      </motion.div>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main
      className={`lab flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground ${
        wide ? "sm:px-8" : ""
      }`}
    >
      {children}
    </main>
  );
}

/** Gentle count-up to the headline number; static under reduced motion. */
function CountUpScore({ score }: { score: number }) {
  const reduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, score, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setAnimated(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, reduceMotion]);

  return (
    <p className="font-mono text-7xl font-semibold tabular-nums tracking-tight">
      {reduceMotion ? score : animated}
    </p>
  );
}

function DomainRow({
  domainKey,
  domain,
}: {
  domainKey: DomainKey;
  domain: BrainScoreResult["domains"][DomainKey];
}) {
  const scored = domain.status === "scored";
  return (
    <li
      className={`rounded-lg border px-4 py-3 text-left ${
        scored ? "border-border bg-card" : "border-dashed border-border bg-transparent"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm font-medium ${scored ? "" : "text-muted-foreground"}`}>
          {DOMAIN_LABELS[domainKey]}
        </span>
        {scored ? (
          <span className="font-mono text-sm tabular-nums">{domain.score}</span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            no clean data
          </span>
        )}
      </div>
      {scored ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${domain.score}%` }}
          />
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{domain.reason}</p>
      )}
    </li>
  );
}

function InsightCards({ insights }: { insights: ReturnType<typeof pickInsights> }) {
  if (insights.kind === "not_enough") {
    return (
      <p className="max-w-sm text-sm text-muted-foreground">
        This run didn&apos;t measure enough areas to point to a strength or a
        growth area.
      </p>
    );
  }

  if (insights.kind === "balanced") {
    return (
      <section className="w-full max-w-md" aria-label="Session insight">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Evenly balanced
          </p>
          <p className="mt-1 text-sm">
            All {insights.scoredCount} measured areas landed on the same score
            ({insights.score}) this run — no single strength or growth area to
            single out.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="grid w-full max-w-md gap-2 sm:grid-cols-2"
      aria-label="Strength and growth area"
    >
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Strongest this run
        </p>
        <p className="mt-1 text-sm font-medium">
          {DOMAIN_LABELS[insights.strength.key]}
        </p>
        <p className="text-xs text-muted-foreground">
          Scored {insights.strength.score} — your sharpest area this sitting.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Most room to grow
        </p>
        <p className="mt-1 text-sm font-medium">
          {DOMAIN_LABELS[insights.growth.key]}
        </p>
        <p className="text-xs text-muted-foreground">
          Scored {insights.growth.score} — the area with the most headroom
          this sitting.
        </p>
      </div>
    </section>
  );
}
