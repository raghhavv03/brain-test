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
  generateItemSequence,
  isTarget,
  TOTAL_ITEMS,
  type Letter,
} from "@/lib/echo/item-sequence";
import { Button } from "@/components/ui/button";
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
  const [message, setMessage] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [letterLabel, setLetterLabel] = useState("");
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [saveFailures, setSaveFailures] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  async function runTask() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("running");
    setItems([]);
    setSaveFailures(0);
    setFatalError(null);
    setMessage("");

    const watcher = createVisibilityWatcher();
    const sequence = isPractice
      ? generateItemSequence(PRACTICE_ITEMS, PRACTICE_TARGETS)
      : generateItemSequence();
    const savePromises: Promise<boolean>[] = [];
    const completed: CompletedItem[] = [];

    try {
      const sessionId = await ensureSession();

      for (let i = 0; i < sequence.length; i++) {
        setItemLabel(`Item ${i + 1} of ${sequence.length}`);
        const item = await runItem(i, sequence, watcher);
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
    watcher: VisibilityWatcher
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

    // Labeled with its own item number rather than cleared-then-set: the
    // fixed 2500ms interval leaves no time slot to show this and clear it
    // before the next item begins, so the message will often still be on
    // screen during item N+1's window. Without the label that reads as if
    // it belongs to the item currently visible — it doesn't.
    setMessage(
      rtMs !== null
        ? `Item ${itemIndex + 1}: ${classification.replace("_", " ")} · ${Math.round(rtMs)} ms`
        : `Item ${itemIndex + 1}: ${classification.replace("_", " ")}`
    );

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
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <h1 className="text-2xl font-semibold">Echo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isPractice ? "2-Back · Practice — not scored" : "2-Back"}
      </p>

      {phase === "running" && (
        <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
          {itemLabel}
        </p>
      )}

      <div
        ref={targetRef}
        data-target
        className="mt-8 flex h-36 w-36 items-center justify-center rounded-full border border-border text-4xl font-bold"
        style={{ visibility: "hidden", transition: "none" }}
      >
        {letterLabel}
      </div>

      <p className="mt-4 min-h-[1.25rem] text-sm">
        {phase === "running" ? message : ""}
      </p>

      {phase === "idle" && (
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <p className="max-w-xs text-sm text-muted-foreground">
            Tap or press space when the current letter matches the one from 2
            items ago. {itemCount} items.
          </p>
          <Button size="lg" onClick={runTask}>
            {isPractice ? "Start practice" : "Start"}
          </Button>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-6 flex w-full max-w-md flex-col items-center gap-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {isPractice ? "Practice Complete" : "Session Complete"}
          </h2>
          {fatalError && (
            <p className="text-sm text-destructive">Error: {fatalError}</p>
          )}
          <div className="grid w-full grid-cols-2 gap-3">
            <StatBox label="Hits" value={`${hits.length} / ${targets.length}`} />
            <StatBox label="Misses" value={`${misses.length}`} />
            <StatBox
              label="Correct rejections"
              value={`${correctRejections.length} / ${nonTargets.length}`}
            />
            <StatBox label="False alarms" value={`${falseAlarms.length}`} />
            <StatBox
              label="Mean hit RT"
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
            <summary className="cursor-pointer text-[11px] uppercase tracking-widest text-muted-foreground">
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
