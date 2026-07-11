"use client";

/**
 * Five-domain radar for the results screen (Recharts).
 *
 * insufficient_data treatment — the design problem here is that a missing
 * measurement must read neither as ZERO (a point at the center — 0 is a real
 * score elsewhere on this chart) nor as BROKEN (a missing axis). So:
 * - The five-axis frame ALWAYS renders in full: every spoke, every label.
 * - The score polygon only has vertices (and dots) on scored domains. Where
 *   a domain is unmeasured, the polygon bridges directly between its scored
 *   neighbours and those bridging edges are DASHED — "no measurement along
 *   here" — while scored-to-scored edges stay solid.
 * - The unmeasured spoke itself is dashed grey and its axis label carries an
 *   explicit "no clean data" tag, so the state is named, not just styled.
 * - The tooltip on that axis says the engine's reason, never a number.
 *
 * The radius scale is pinned to [0, 100]: without it Recharts auto-scales to
 * the data max, which would inflate a weak run to fill the chart.
 */

import { useLayoutEffect, useRef, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";
import { DOMAIN_KEYS, type DomainScores } from "@/lib/scoring/types";
import { DOMAIN_LABELS } from "./labels";
import { radarPolygon } from "./radar-geometry";

type AxisEntry = {
  key: string;
  label: string;
  /** Geometry only — never displayed for unscored domains. */
  value: number;
  scored: boolean;
  score: number | null;
  reason: string | null;
};

type RadarShapePoint = {
  x: number;
  y: number;
  cx?: number;
  cy?: number;
  angle: number;
  payload?: AxisEntry;
};

const RADIAN = Math.PI / 180;
const ACCENT = "var(--primary)";
const MAX_SIZE = 400;
const LABEL_MARGIN = 64;

export function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  return {
    x: cx + r * Math.cos(-angleDeg * RADIAN),
    y: cy + r * Math.sin(-angleDeg * RADIAN),
  };
}

export function DomainRadar({ domains }: { domains: DomainScores }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data: AxisEntry[] = DOMAIN_KEYS.map((key) => {
    const domain = domains[key];
    const scored = domain.status === "scored";
    return {
      key,
      label: DOMAIN_LABELS[key],
      value: scored ? domain.score : 0,
      scored,
      score: scored ? domain.score : null,
      reason: scored ? null : domain.reason,
    };
  });

  const size = Math.min(width, MAX_SIZE);
  const outerRadius = size / 2 - LABEL_MARGIN;
  const hasUnmeasured = data.some((d) => !d.scored);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[400px]">
      {size > 0 && (
        <RadarChart
          width={size}
          height={size}
          cx={size / 2}
          cy={size / 2}
          outerRadius={outerRadius}
          data={data}
        >
          <PolarGrid
            gridType="polygon"
            radialLines={false}
            stroke="var(--border)"
          />
          <PolarAngleAxis
            dataKey="label"
            tickLine={false}
            tick={(props) => <AxisTick {...props} data={data} />}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            isAnimationActive={false}
            // Recharts' default hover dot would render at the geometry value
            // — the center for unmeasured domains, reading as a zero score.
            activeDot={false}
            dot={false}
            shape={(props: { points?: RadarShapePoint[] }) => (
              <ScoreShape points={props.points ?? []} outerRadius={outerRadius} />
            )}
          />
          <Tooltip content={<DomainTooltip />} cursor={false} />
        </RadarChart>
      )}
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        0–100 per area, this run only
        {hasUnmeasured && " · dashed = not enough clean data"}
      </p>
    </div>
  );
}

/**
 * Spokes for all five axes plus the score polygon over scored domains only.
 * Rendered as the Radar's custom shape so the vertex positions are exactly
 * Recharts' own scale computation.
 */
function ScoreShape({
  points,
  outerRadius,
}: {
  points: RadarShapePoint[];
  outerRadius: number;
}) {
  if (points.length === 0) return <g />;
  const cx = points[0].cx ?? 0;
  const cy = points[0].cy ?? 0;

  const scoredFlags = points.map((p) => !!p.payload?.scored);
  const {
    vertexIndices: scoredIdx,
    edges: edgeIdx,
    hasFill,
  } = radarPolygon(scoredFlags);

  const edges = edgeIdx.map((e) => ({
    from: points[e.from],
    to: points[e.to],
    bridged: e.bridged,
  }));

  const fillPath = hasFill
    ? scoredIdx
        .map((i, j) => `${j === 0 ? "M" : "L"}${points[i].x},${points[i].y}`)
        .join(" ") + " Z"
    : null;

  return (
    <g>
      {points.map((p) => {
        const outer = polarPoint(cx, cy, outerRadius, p.angle);
        return (
          <line
            key={`spoke-${p.payload?.key ?? p.angle}`}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke={p.payload?.scored ? "var(--border)" : "var(--muted-foreground)"}
            strokeOpacity={p.payload?.scored ? 1 : 0.55}
            strokeDasharray={p.payload?.scored ? undefined : "3 5"}
          />
        );
      })}
      {fillPath && <path d={fillPath} fill={ACCENT} fillOpacity={0.15} />}
      {edges.map((e, i) => (
        <line
          key={`edge-${i}`}
          x1={e.from.x}
          y1={e.from.y}
          x2={e.to.x}
          y2={e.to.y}
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={e.bridged ? "6 6" : undefined}
        />
      ))}
      {scoredIdx.map((i) => (
        <circle
          key={`dot-${i}`}
          cx={points[i].x}
          cy={points[i].y}
          r={4}
          fill={ACCENT}
          stroke="var(--background)"
          strokeWidth={2}
        />
      ))}
    </g>
  );
}

type TickProps = {
  x?: number | string;
  y?: number | string;
  cy?: number | string;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  payload?: { value?: string };
  data: AxisEntry[];
};

/** Axis label: wrapped words, plus an explicit tag on unmeasured domains. */
function AxisTick({ x: rawX, y: rawY, cy: rawCy, textAnchor, payload, data }: TickProps) {
  const x = Number(rawX ?? 0);
  const y = Number(rawY ?? 0);
  const cy = Number(rawCy ?? 0);
  const entry = data.find((d) => d.label === payload?.value);
  const words = (payload?.value ?? "").split(" ");
  const above = y < cy;
  // Anchor multi-line labels so they grow away from the chart.
  const firstDy = above ? -(words.length - 1) * 12 : 12;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={11}
      fill={entry?.scored ? "var(--foreground)" : "var(--muted-foreground)"}
    >
      {words.map((word, i) => (
        <tspan key={word} x={x} dy={i === 0 ? firstDy : 12}>
          {word}
        </tspan>
      ))}
      {entry && !entry.scored && (
        <tspan x={x} dy={12} fontSize={9} fontStyle="italic">
          no clean data
        </tspan>
      )}
    </text>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload?: AxisEntry }[];
};

function DomainTooltip({ active, payload }: TooltipProps) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  return (
    <div className="max-w-[220px] rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{entry.label}</p>
      {entry.scored ? (
        <p className="mt-0.5 text-muted-foreground">
          <span className="font-mono text-sm text-foreground">{entry.score}</span> / 100
        </p>
      ) : (
        <p className="mt-0.5 text-muted-foreground">{entry.reason}</p>
      )}
    </div>
  );
}
