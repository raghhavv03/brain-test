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
  generateItemSequence,
  isTarget,
  TOTAL_ITEMS,
  type Letter,
} from "@/lib/echo/item-sequence";
import { useMotionPreference } from "@/lib/hooks/use-motion-preference";
import { Button } from "@/components/ui/button";
import {
  PrevFeedback,
  type PrevItemFeedback,
} from "@/components/echo/prev-feedback";
import { ReducedMotionToggle } from "@/components/lab/reduced-motion-toggle";
import type { GameProps } from "@/components/games/types";

// Echo skeleton: fixed 2500ms SOA, letter visible for 500ms.
const STIMULUS_VISIBLE_MS = 500;
const INTERVAL_MS = 2500;
// Practice: same SOA and forced-target construction, just a shorter stream.
const PRACTICE_ITEMS = 8;
const PRACTICE_TARGETS = 2;
const GAME = "echo";

type Classification = "hit" | "false_alarm" | "miss" | "correct_rejection";

type CompletedItem = {
  itemIndex: number;
  letter: Letter;
  isTarget: boolean;
  response: CapturedResponse | null;
  rtMs: number | null;
  correct: boolean;
  classification: Classification;
  discarded: boolean;
};

type Phase = "idle" | "running" | "done";

export function EchoGame({
  mode = "scored",
  runId = null,
  onComplete,
}: GameProps) {
  const isPractice = mode === "practice";
  const itemCount = isPractice ? PRACTICE_ITEMS : TOTAL_ITEMS;

  const [phase, setPhase] = useState<Phase>("idle");
  const [prevFeedback, setPrevFeedback] = useState<PrevItemFeedback | null>(
    null
  );
  const [decodedCount, setDecodedCount] = useState(0);
  const [itemLabel, setItemLabel] = useState("");
  const [letterLabel, setLetterLabel] = useState("");
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reducedMotion, toggleReducedMotion] = useMotionPreference();
  const targetRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  // Display-only: mirrors each classified item into the "previous signal"
  // chip and the decoded counter — the same onResult display-state hook used
  // in Trigger and Gatekeeper's skin passes. Called only after the item's
  // fixed interval has fully elapsed, never during it.
  function handleItemResult(item: CompletedItem) {
    setPrevFeedback({
      itemNumber: item.itemIndex + 1,
      classification: item.classification,
      rtMs: item.rtMs,
    });
    if (item.classification === "hit") {
      setDecodedCount((prev) => prev + 1);
    }
  }

  async function runTask() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("running");
    setItems([]);
    setSaveFailures(0);
    setFatalError(null);
    setPrevFeedback(null);
    setDecodedCount(0);

    const watcher = createVisibilityWatcher();
    const sequence = isPractice
      ? generateItemSequence(PRACTICE_ITEMS, PRACTICE_TARGETS)
      : generateItemSequence();
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedItem[] = [];

    try {
      const sessionId = await ensureSession();

      for (let i = 0; i < sequence.length; i++) {
        setItemLabel(`Signal ${i + 1} of ${sequence.length}`);
        const item = await runItem(i, sequence, watcher, handleItemResult);
        completed.push(item);
        savePromises.push(
          saveTrial({
            session_id: sessionId,
            run_id: runId,
            game: GAME,
            trial_index: item.itemIndex,
            stimulus: {
              letter: item.letter,
              is_target: item.isTarget,
              classification: item.classification,
            },
            response: item.response
              ? {
                  type: item.response.type,
                  ...(item.response.key !== undefined
                    ? { key: item.response.key }
                    : {}),
                }
              : null,
            rt_ms: item.rtMs,
            correct: item.correct,
            discarded: item.discarded,
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
      setItems(completed);
      setPhase("done");
      watcher.destroy();
      runningRef.current = false;
    }
  }

  async function runItem(
    itemIndex: number,
    sequence: Letter[],
    watcher: VisibilityWatcher,
    onResult: (item: CompletedItem) => void
  ): Promise<CompletedItem> {
    const target = targetRef.current;
    if (!target) throw new Error("Stimulus element missing.");

    target.style.visibility = "hidden";
    watcher.reset();
    setLetterLabel("");

    const letter = sequence[itemIndex];
    const targetFlag = isTarget(sequence, itemIndex);

    const responder = awaitResponse();
    let captured: CapturedResponse | null = null;
    // Fire-and-forget: records the first response if one arrives, but never
    // gates the loop's pacing — the fixed 2500ms interval always elapses in
    // full, regardless of whether/when a response happens.
    responder.promise.then((r) => {
      captured = r;
    });

    setLetterLabel(letter);
    const onsetMs = await showStimulusAtNextFrame(target);
    // Invariant: no React state updates between onset and the end of the
    // fixed interval below — a re-render would re-apply the hidden style.
    await sleep(STIMULUS_VISIBLE_MS);
    target.style.visibility = "hidden";
    await sleep(INTERVAL_MS - STIMULUS_VISIBLE_MS);
    responder.cancel();

    // Classify by the measurement, not by response timing relative to our
    // own wait: a response timestamped beyond the fixed interval must not
    // count as valid (same boundary guard as Trigger/Gatekeeper). The
    // responder is attached before onset (before the reveal), so a tap
    // landing in that pre-onset gap — e.g. a late response actually meant
    // for the previous item — would otherwise yield a negative measuredRt
    // and incorrectly pass an upper-bound-only check; reject those too.
    const measuredRt =
      captured !== null
        ? (captured as CapturedResponse).timestamp - onsetMs
        : null;
    const withinWindow =
      measuredRt !== null && measuredRt >= 0 && measuredRt <= INTERVAL_MS;
    const response = withinWindow ? captured : null;
    const rtMs = withinWindow ? measuredRt : null;
    const responded = response !== null;

    const correct = targetFlag ? responded : !responded;
    const classification: Classification = targetFlag
      ? responded
        ? "hit"
        : "miss"
      : responded
        ? "false_alarm"
        : "correct_rejection";

    const item: CompletedItem = {
      itemIndex,
      letter,
      isTarget: targetFlag,
      response,
      rtMs,
      correct,
      classification,
      discarded: watcher.compromised,
    };
    // Reported with its own item number rather than cleared-then-set: the
    // fixed 2500ms interval leaves no time slot to show feedback and clear
    // it before the next item begins, so the chip will often still be on
    // screen during item N+1's window. The onResult hook (same display-state
    // pattern as Trigger/Gatekeeper) renders it as an explicitly-labelled,
    // dimmed "previous signal" chip so it can't read as the current item's.
    onResult(item);
    return item;
  }

  const targets = items.filter((it) => it.isTarget);
  const nonTargets = items.filter((it) => !it.isTarget);
  const hits = targets.filter((it) => it.classification === "hit");
  const misses = targets.filter((it) => it.classification === "miss");
  const falseAlarms = nonTargets.filter(
    (it) => it.classification === "false_alarm"
  );
  const correctRejections = nonTargets.filter(
    (it) => it.classification === "correct_rejection"
  );
  const validHitRts = hits
    .filter((it) => !it.discarded && it.rtMs !== null)
    .map((it) => it.rtMs as number);
  const meanHitRt =
    validHitRts.length > 0
      ? validHitRts.reduce((sum, rt) => sum + rt, 0) / validHitRts.length
      : null;

  return (
    <div className="lab flex min-h-screen flex-col items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-md items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Cognitive Performance Lab
        </span>
        <div className="flex items-center gap-3">
          {decodedCount > 0 && (
            <motion.span
              key={decodedCount}
              initial={reducedMotion ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[11px] uppercase tracking-widest text-primary"
            >
              DECODED {decodedCount}
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
            Echo
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {isPractice ? "Practice — not scored" : "Signal Decoder"}
          </p>
        </div>

        {phase === "running" && (
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {itemLabel}
          </span>
        )}

        <div className="relative h-40 w-40">
          {/* persistent decoder frame, so the blank gap between letters
              still reads as an instrument awaiting the next signal */}
          <div className="absolute inset-0 rounded-full border border-dashed border-border" />
          <div
            ref={targetRef}
            data-target
            className="absolute inset-0 flex items-center justify-center rounded-full font-mono text-6xl font-bold text-foreground"
            style={{
              visibility: "hidden",
              transition: "none",
              background:
                "radial-gradient(circle at 35% 35%, #1e3a8a, #172554 60%, #0b1220 100%)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 60%, transparent)",
              boxShadow:
                "0 0 60px 10px color-mix(in srgb, var(--primary) 40%, transparent)",
            }}
          >
            {letterLabel}
          </div>
        </div>

        <PrevFeedback
          feedback={phase === "running" ? prevFeedback : null}
          reducedMotion={reducedMotion}
        />

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Watch the stream. Tap or press space when the current letter
              matches the one from 2 signals ago. {itemCount} signals.
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
                label="Decoded"
                value={`${hits.length} / ${targets.length}`}
              />
              <StatBox label="Missed" value={`${misses.length}`} />
              <StatBox
                label="Held"
                value={`${correctRejections.length} / ${nonTargets.length}`}
              />
              <StatBox label="False decodes" value={`${falseAlarms.length}`} />
              <StatBox
                label="Mean decode"
                value={meanHitRt !== null ? `${Math.round(meanHitRt)} ms` : "—"}
              />
              <StatBox
                label="Discarded"
                value={`${items.filter((it) => it.discarded).length}`}
              />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Save failures: {saveFailures}
            </p>
            <details className="w-full">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Per-item log
              </summary>
              <ol className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                {items.map((it) => (
                  <li key={it.itemIndex}>
                    {String(it.itemIndex + 1).padStart(2, "0")} · {it.letter} ·{" "}
                    {it.isTarget ? "target" : "non-target"} ·{" "}
                    {it.classification}
                    {it.rtMs !== null ? ` · ${Math.round(it.rtMs)} ms` : ""}
                    {it.discarded ? " (discarded)" : ""}
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
