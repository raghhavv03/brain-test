"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

// Cosmetic scale only — unrelated to RESPONSE_DEADLINE_MS or any classification threshold.
const GAUGE_FAST_MS = 150;
const GAUGE_SLOW_MS = 600;

export type GaugeStatus = "idle" | "hit" | "miss" | "false-start";

type ReflexGaugeProps = {
  rtMs: number | null;
  status: GaugeStatus;
  reducedMotion: boolean;
};

function angleFor(status: GaugeStatus, rtMs: number | null): number {
  if (status !== "hit" || rtMs === null) {
    return status === "idle" ? 0 : -90; // miss / false start pinned to the slow end
  }
  const clamped = Math.min(Math.max(rtMs, GAUGE_FAST_MS), GAUGE_SLOW_MS);
  const progress = (GAUGE_SLOW_MS - clamped) / (GAUGE_SLOW_MS - GAUGE_FAST_MS);
  return -90 + progress * 180;
}

function readoutFor(status: GaugeStatus, rtMs: number | null): string {
  if (status === "hit" && rtMs !== null) return `${Math.round(rtMs)} ms`;
  if (status === "false-start") return "FALSE START";
  if (status === "miss") return "NO RESPONSE";
  return "—";
}

export function ReflexGauge({ rtMs, status, reducedMotion }: ReflexGaugeProps) {
  const angle = angleFor(status, rtMs);
  const needleRef = useRef<SVGGElement>(null);
  const currentAngleRef = useRef(angle);

  // Drives the SVG's native rotate(angle) attribute directly, rather than a
  // CSS transform. Framer Motion's motion.g + animate({ rotate }) silently
  // defaults SVG transform-origin to "50% 50%" of the needle's own bounding
  // box (its midpoint), overriding any transformOrigin style we set — which
  // detaches the needle from the pivot dot at the geometry's actual origin.
  // rotate(angle) with no center args rotates around the current user-space
  // origin (0,0), which is exactly the pivot thanks to the outer
  // translate(100 100), with no bounding-box ambiguity possible.
  useEffect(() => {
    const node = needleRef.current;
    if (!node) return;

    const applyAngle = (value: number) => {
      node.setAttribute("transform", `rotate(${value})`);
    };

    if (reducedMotion) {
      currentAngleRef.current = angle;
      applyAngle(angle);
      return;
    }

    const controls = animate(currentAngleRef.current, angle, {
      type: "spring",
      stiffness: 140,
      damping: 16,
      onUpdate: (value) => {
        currentAngleRef.current = value;
        applyAngle(value);
      },
    });

    return () => controls.stop();
  }, [angle, reducedMotion]);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-56">
        <defs>
          <linearGradient id="reflex-gauge-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--destructive)" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#reflex-gauge-arc)"
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.5}
        />
        <g transform="translate(100 100)">
          <g ref={needleRef}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-72}
              stroke="var(--foreground)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
          <circle cx={0} cy={0} r={6} fill="var(--foreground)" />
        </g>
        <text
          x={14}
          y={109}
          fontSize={9}
          fill="var(--muted-foreground)"
          fontFamily="var(--font-mono)"
          letterSpacing="0.1em"
        >
          SLOW
        </text>
        <text
          x={156}
          y={109}
          fontSize={9}
          fill="var(--muted-foreground)"
          fontFamily="var(--font-mono)"
          letterSpacing="0.1em"
        >
          FAST
        </text>
      </svg>
      <div className="font-mono text-lg tracking-wide text-foreground">
        {readoutFor(status, rtMs)}
      </div>
    </div>
  );
}
