"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BOARD, type CircuitNode, type NodeId } from "@/lib/circuit/board";

// Native node diameter at full (600px) board width, per the design's
// original 44px buttons. Below that, diameter scales down with the board's
// own rendered width (cqw) so it never overlaps the 70px center-to-center
// MIN_GAP from board.ts — floored at 32px so it stays tappable at any size.
const NODE_DIAMETER_PX = 44;
const NODE_MIN_DIAMETER_PX = 32;
const NODE_SIZE = `clamp(${NODE_MIN_DIAMETER_PX}px, ${
  (NODE_DIAMETER_PX / BOARD.width) * 100
}cqw, ${NODE_DIAMETER_PX}px)`;

type CircuitBoardProps = {
  ref: React.Ref<HTMLDivElement>;
  board: CircuitNode[];
  sequence: readonly NodeId[];
  completedCount: number;
  wrongNodeId: string | null;
  wrongTick: number;
  reducedMotion: boolean;
  onNodeTap: (id: string) => () => void;
};

/**
 * Purely presentational node board. The container ref + hidden-visibility
 * mechanism belongs to the timing engine (board reveal marks stimulus onset),
 * and every node fires the game's own onNodeTap handler directly on
 * pointerdown — no wrapper, no animation between tap and capture. The glowing
 * trail and node states are derived entirely from already-recorded taps.
 * The next expected node is deliberately NOT highlighted: finding it is the
 * task being measured.
 */
export function CircuitBoard({
  ref,
  board,
  sequence,
  completedCount,
  wrongNodeId,
  wrongTick,
  reducedMotion,
  onNodeTap,
}: CircuitBoardProps) {
  const linked = sequence.slice(0, completedCount);
  const nodeById = new Map(board.map((n) => [n.id, n]));
  const trailPoints = linked
    .map((id) => nodeById.get(id))
    .filter((n): n is CircuitNode => Boolean(n))
    .map((n) => `${n.x},${n.y}`)
    .join(" ");
  const linkedIds = new Set<string>(linked);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-2xl border border-border bg-background/60"
      style={{
        maxWidth: BOARD.width,
        // Nodes are positioned by percentage of the logical 600x400 board, so
        // the on-screen shape must always keep the board's proportions.
        aspectRatio: `${BOARD.width} / ${BOARD.height}`,
        visibility: "hidden",
        transition: "none",
        // Lets node buttons size themselves off this container's own
        // rendered width (cqw), not the viewport — see the button's
        // clamp() below.
        containerType: "inline-size",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--primary) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {completedCount > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={trailPoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.18}
          />
          <polyline
            points={trailPoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        </svg>
      )}
      {board.map((node) => {
        const isLinked = linkedIds.has(node.id);
        const isWrong = node.id === wrongNodeId;
        return (
          <span
            key={node.id}
            className="absolute block -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(node.x / BOARD.width) * 100}%`,
              top: `${(node.y / BOARD.height) * 100}%`,
            }}
          >
            {!reducedMotion && (
              <AnimatePresence>
                {isWrong && (
                  <motion.span
                    key={wrongTick}
                    initial={{ opacity: 0.7, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.9 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-destructive"
                  />
                )}
              </AnimatePresence>
            )}
            <button
              type="button"
              onPointerDown={onNodeTap(node.id)}
              className={`flex items-center justify-center rounded-full border font-mono text-sm font-semibold ${
                isLinked
                  ? "border-primary bg-primary/20 text-primary"
                  : isWrong
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-secondary/70 text-foreground"
              }`}
              style={{
                width: NODE_SIZE,
                height: NODE_SIZE,
                ...(isLinked
                  ? { boxShadow: "0 0 16px -2px var(--primary)" }
                  : undefined),
              }}
            >
              {node.id}
            </button>
          </span>
        );
      })}
    </div>
  );
}
