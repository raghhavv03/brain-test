"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { useMotionPreference } from "@/lib/hooks/use-motion-preference";
import { Button } from "@/components/ui/button";
import { ReducedMotionToggle } from "@/components/lab/reduced-motion-toggle";
import type { GameProps } from "@/components/games/types";

const GAME = "lockon";
// Practice: one round at K=2 — below the scored K=3–6 range, same physics,
// marking, and selection mechanics, no escalation.
const PRACTICE_K = 2;
// Selection is spatial and untimed, so taps get a forgiving halo.
const HIT_PAD_PX = 10;
const FEEDBACK_MS = 1500; // between-round reveal — pacing only, not measured

// Skin-only rendering constants. The orb is baked once into an offscreen
// sprite (gradient + halo) and blitted per frame — no per-frame gradient or
// shadowBlur work, which is what tanks phone frame rates at N=12.
const ORB_GLOW_PAD = 10;
const ORB_SPRITE_SIZE = (OBJECT_RADIUS + ORB_GLOW_PAD) * 2;
const TRAIL_FADE_ALPHA = 0.3;

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
  // Motion frames only: fade the previous frame instead of clearing it, so
  // every object leaves a short luminous trail. One translucent fillRect —
  // identical for targets and distractors.
  trail?: boolean;
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
  const [reducedMotion, toggleReducedMotion] = useMotionPreference();
  // Display-only pulses, both confined to the untimed selection/feedback
  // phases: a ring at each lock tap, and the "lock-on confirmed" flash.
  const [lockPulse, setLockPulse] = useState<{
    x: number;
    y: number;
    tick: number;
  } | null>(null);
  const [confirmTick, setConfirmTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundRef = useRef<Round | null>(null);
  const selectedRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>("idle");
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const confirmRef = useRef<(() => void) | null>(null);
  const watcherRef = useRef<VisibilityWatcher | null>(null);
  // Skin refs: theme colors resolved from the .lab CSS tokens once on mount,
  // the pre-rendered orb sprite, and a reduced-motion mirror readable from
  // inside the rAF loop's closures.
  const paletteRef = useRef<LabPalette | null>(null);
  const orbSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

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
    paletteRef.current = readLabPalette(canvas);
    orbSpriteRef.current = buildOrbSprite(paletteRef.current, dpr);
    return () => {
      cancelAnimationFrame(rafRef.current);
      watcherRef.current?.destroy();
      watcherRef.current = null;
    };
  }, []);

  /**
   * The only render path for objects. During marking/feedback the opts flags
   * add reticles/rings, but in the motion and selection phases every object
   * is drawn by the identical unconditional sprite blit — target status never
   * reaches the canvas output once marking ends. The trail effect is a single
   * translucent fill over the whole previous frame, so it too is identical
   * for targets and distractors and carries no information.
   */
  function draw(round: Round, opts: DrawOptions = {}) {
    const ctx = canvasRef.current?.getContext("2d");
    const palette = paletteRef.current;
    const sprite = orbSpriteRef.current;
    if (!ctx || !palette || !sprite) return;

    if (opts.trail && !reducedMotionRef.current) {
      ctx.fillStyle = `rgba(${palette.bgRgb.r}, ${palette.bgRgb.g}, ${palette.bgRgb.b}, ${TRAIL_FADE_ALPHA})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    } else {
      ctx.clearRect(0, 0, ARENA.width, ARENA.height);
    }

    round.objects.forEach((o, i) => {
      ctx.drawImage(
        sprite,
        o.x - ORB_SPRITE_SIZE / 2,
        o.y - ORB_SPRITE_SIZE / 2,
        ORB_SPRITE_SIZE,
        ORB_SPRITE_SIZE
      );

      const isTarget = round.targetIndices.includes(i);
      const isSelected = opts.selected?.has(i) ?? false;

      if (opts.markTargets && isTarget) {
        drawReticle(ctx, o.x, o.y, palette.primary);
      }
      if (opts.revealTargets) {
        // Reveal grammar: locked target = primary, escaped target = solid
        // destructive, false lock = dashed destructive.
        if (isTarget) {
          drawRing(
            ctx,
            o.x,
            o.y,
            OBJECT_RADIUS + 5,
            isSelected ? palette.primary : palette.destructive,
            3
          );
        } else if (isSelected) {
          drawRing(ctx, o.x, o.y, OBJECT_RADIUS + 5, palette.destructive, 3, true);
        }
      } else if (isSelected) {
        drawRing(ctx, o.x, o.y, OBJECT_RADIUS + 5, palette.foreground, 2.5);
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
          // in place without rings before motion begins next frame. The trail
          // flag is false on exactly this frame (now === motionOnset), so it
          // is a full clear — no ghost of the marking rings survives into
          // the motion phase.
        }

        stepPhysics(round.objects, (now - lastFrame) / 1000, ARENA, OBJECT_RADIUS);
        lastFrame = now;
        draw(round, { trail: now > motionOnset });

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
      // Display-only lock pulse at the tap point (CSS px within the canvas
      // box). Selection is untimed, so this re-render costs nothing measured.
      setLockPulse((prev) => ({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        tick: (prev?.tick ?? 0) + 1,
      }));
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
    setLockPulse(null);
    setConfirmTick(0);

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
        setLockPulse(null);
        setRoundK(round.k);
        setStatusLine(`Round ${roundIndex + 1} — track ${round.k} targets`);

        watcher.reset();
        transition("marking");
        const measured = await runMarkAndMotion(round);
        transition("select");
        // Fresh, trail-free frame for the untimed selection phase.
        draw(round, { selected: selectedRef.current });
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
    <div className="lab flex min-h-screen flex-col items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Cognitive Performance Lab
        </span>
        <div className="flex items-center gap-3">
          {phase !== "idle" && phase !== "done" && (
            <motion.span
              key={roundK}
              initial={reducedMotion ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[11px] uppercase tracking-widest text-primary"
            >
              LEVEL K{roundK}
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
        className="mt-10 flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-border bg-card px-6 py-10 shadow-2xl sm:px-8"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-3xl font-semibold uppercase tracking-[0.2em]">
            Lock-On
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {isPractice ? "Practice — not scored" : "Target Tracking"}
          </p>
        </div>

        <p
          data-testid="status"
          className="min-h-[1.25rem] font-mono text-xs uppercase tracking-widest text-muted-foreground"
        >
          {statusLine}
        </p>

        <div className="relative w-full" style={{ maxWidth: ARENA.width }}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            className="w-full rounded-2xl border border-border"
            style={{
              // Hit-testing scales x and y independently against the arena,
              // so the on-screen shape must always match the arena's
              // proportions.
              aspectRatio: `${ARENA.width} / ${ARENA.height}`,
              touchAction: "none",
              background: "var(--background)",
            }}
          />
          {!reducedMotion && (
            <>
              <AnimatePresence>
                {lockPulse && phase === "select" && (
                  <motion.span
                    key={lockPulse.tick}
                    initial={{ opacity: 0.9, scale: 0.4 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="pointer-events-none absolute h-14 w-14 rounded-full border-2 border-primary"
                    style={{ left: lockPulse.x - 28, top: lockPulse.y - 28 }}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {confirmTick > 0 && phase === "feedback" && (
                  <motion.div
                    key={confirmTick}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <span className="rounded-full border border-primary/60 bg-primary/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary">
                      Lock-on confirmed
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              {numObjects(startK)} orbs appear; {startK} are tagged with lock
              reticles. The tags vanish and the orbs scatter — keep tracking
              them. When they freeze, tap the ones that were tagged.
              {isPractice
                ? " One warm-up round."
                : " Each level adds more targets — and more orbs."}
            </p>
            <Button size="lg" onClick={runGame}>
              {isPractice ? "Start practice" : "Start"}
            </Button>
          </div>
        )}

        {phase === "select" && (
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Tap the {roundK} targets —{" "}
              <span className="text-primary">
                {selectedCount} of {roundK}
              </span>{" "}
              locked
            </p>
            <Button
              size="lg"
              disabled={selectedCount !== roundK}
              onClick={() => {
                setConfirmTick((tick) => tick + 1);
                confirmRef.current?.();
              }}
            >
              Confirm lock
            </Button>
          </div>
        )}

        {phase === "done" && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {isPractice ? "Practice Complete" : "Session Complete"}
            </h2>
            {fatalError && (
              <p className="text-sm text-destructive">Error: {fatalError}</p>
            )}
            {endReasonLabel && (
              <p className="text-sm text-muted-foreground">{endReasonLabel}</p>
            )}
            <div className="grid w-full grid-cols-2 gap-3">
              {!isPractice && (
                <StatBox
                  label="Peak lock"
                  value={maxKPassed !== null ? `${maxKPassed} targets` : "—"}
                />
              )}
              <StatBox label="Rounds" value={`${rounds.length}`} />
              <StatBox
                label="Discarded"
                value={`${rounds.filter((r) => r.discarded).length}`}
              />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Save failures: {saveFailures}
            </p>
            <details className="w-full">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Per-round log
              </summary>
              <ol className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                {rounds.map((r) => (
                  <li key={r.roundIndex}>
                    {String(r.roundIndex + 1).padStart(2, "0")} · K={r.k} ·{" "}
                    {r.correctCount}/{r.k} locked
                    {r.discarded ? " (discarded)" : ""}
                  </li>
                ))}
              </ol>
            </details>
            {onComplete ? (
              <Button size="lg" onClick={onComplete}>
                {isPractice ? "Start the real round" : "Continue"}
              </Button>
            ) : (
              <Button size="lg" onClick={runGame}>
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

// ---------------------------------------------------------------------------
// Skin helpers — colors and sprites only; nothing below touches measurement.
// ---------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };

type LabPalette = {
  primary: string;
  destructive: string;
  foreground: string;
  bgRgb: Rgb;
};

/** Resolve the .lab design tokens from CSS so canvas paint stays themed. */
function readLabPalette(el: HTMLElement): LabPalette {
  const styles = getComputedStyle(el);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    primary: token("--primary", "#3b82f6"),
    destructive: token("--destructive", "#f87171"),
    foreground: token("--foreground", "#f5f5f5"),
    bgRgb: hexToRgb(token("--background", "#0a0a0a")) ?? {
      r: 10,
      g: 10,
      b: 10,
    },
  };
}

function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function cssRgb({ r, g, b }: Rgb, alpha = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Bake the neutral orb (halo + body with off-center highlight) into an
 * offscreen sprite once. All orbs share this one sprite, so targets and
 * distractors are pixel-identical by construction.
 */
function buildOrbSprite(palette: LabPalette, dpr: number): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = ORB_SPRITE_SIZE * dpr;
  sprite.height = ORB_SPRITE_SIZE * dpr;
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  ctx.scale(dpr, dpr);

  const center = ORB_SPRITE_SIZE / 2;
  const fg = hexToRgb(palette.foreground) ?? { r: 245, g: 245, b: 245 };
  const bg = palette.bgRgb;
  const haloColor = mixRgb(fg, bg, 0.45);

  const halo = ctx.createRadialGradient(
    center,
    center,
    OBJECT_RADIUS * 0.6,
    center,
    center,
    center
  );
  halo.addColorStop(0, cssRgb(haloColor, 0.35));
  halo.addColorStop(1, cssRgb(haloColor, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ORB_SPRITE_SIZE, ORB_SPRITE_SIZE);

  const body = ctx.createRadialGradient(
    center - 6,
    center - 6,
    2,
    center,
    center,
    OBJECT_RADIUS
  );
  body.addColorStop(0, cssRgb(mixRgb(fg, bg, 0.12)));
  body.addColorStop(0.6, cssRgb(mixRgb(fg, bg, 0.5)));
  body.addColorStop(1, cssRgb(mixRgb(fg, bg, 0.75)));
  ctx.beginPath();
  ctx.arc(center, center, OBJECT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  return sprite;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  width: number,
  dashed = false
) {
  ctx.beginPath();
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
}

/** Marking-phase lock reticle: ring plus four compass ticks. */
function drawReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) {
  drawRing(ctx, x, y, OBJECT_RADIUS + 6, color, 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * (OBJECT_RADIUS + 10), y + dy * (OBJECT_RADIUS + 10));
    ctx.lineTo(x + dx * (OBJECT_RADIUS + 16), y + dy * (OBJECT_RADIUS + 16));
    ctx.stroke();
  }
}
