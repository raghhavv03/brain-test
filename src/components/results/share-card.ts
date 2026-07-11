/**
 * Shareable result-card SVG builder — a fixed-size, self-contained image
 * (colors hardcoded, not CSS variables) since it's rasterized off-DOM via an
 * <img>/<canvas> pipeline with no page style context, and is meant to look
 * the same regardless of the *viewer's* device theme once shared elsewhere.
 * Colors are the lab theme's literal values from globals.css.
 *
 * Reuses the same geometry primitives as the on-screen radar
 * (domain-radar.tsx's exported polarPoint, and radar-geometry.ts's
 * radarPolygon) rather than re-deriving vertex/edge selection. The one
 * genuinely new piece is the value→radius mapping: Recharts' PolarRadiusAxis
 * does this implicitly on-screen (domain=[0,100]); here it's spelled out
 * explicitly since there's no Recharts in a static SVG string.
 */

import { polarPoint } from "./domain-radar";
import { radarPolygon } from "./radar-geometry";
import { DOMAIN_LABELS } from "./labels";
import { DOMAIN_KEYS, type DomainScores, type Headline } from "@/lib/scoring/types";

export const SHARE_CARD_SIZE = 1080;

const RADIAN = Math.PI / 180;

// Lab theme literals (globals.css .lab block) — see file header.
const COLOR = {
  background: "#0a0a0a",
  foreground: "#f5f5f5",
  card: "#111318",
  primary: "#3b82f6",
  mutedForeground: "#9ca3af",
  border: "rgba(255,255,255,0.14)",
  borderDim: "rgba(255,255,255,0.35)",
} as const;

type ScoredHeadline = Extract<Headline, { status: "scored" }>;

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function buildShareCardSvg({
  headline,
  domains,
}: {
  headline: ScoredHeadline;
  domains: DomainScores;
}): string {
  const size = SHARE_CARD_SIZE;
  const cx = size / 2;

  // ---- radar geometry -------------------------------------------------
  const radarCy = 700;
  const outerRadius = 210;
  const n = DOMAIN_KEYS.length;
  const angleStep = 360 / n;

  const axes = DOMAIN_KEYS.map((key, i) => {
    const domain = domains[key];
    const scored = domain.status === "scored";
    const angleDeg = 90 - i * angleStep;
    const spokeEnd = polarPoint(cx, radarCy, outerRadius, angleDeg);
    const vertex = scored
      ? polarPoint(cx, radarCy, (domain.score / 100) * outerRadius, angleDeg)
      : null;
    return { key, label: DOMAIN_LABELS[key], scored, angleDeg, spokeEnd, vertex };
  });

  const { vertexIndices, edges, hasFill } = radarPolygon(axes.map((a) => a.scored));

  const spokesSvg = axes
    .map(
      (a) => `<line x1="${cx}" y1="${radarCy}" x2="${a.spokeEnd.x.toFixed(1)}" y2="${a.spokeEnd.y.toFixed(1)}"
        stroke="${a.scored ? COLOR.border : COLOR.borderDim}" stroke-width="2"
        ${a.scored ? "" : 'stroke-dasharray="4 7"'} />`
    )
    .join("\n");

  const fillPathSvg = hasFill
    ? `<path d="${vertexIndices
        .map((i, j) => `${j === 0 ? "M" : "L"}${axes[i].vertex!.x.toFixed(1)},${axes[i].vertex!.y.toFixed(1)}`)
        .join(" ")} Z" fill="${COLOR.primary}" fill-opacity="0.18" />`
    : "";

  const edgesSvg = edges
    .map((e) => {
      const from = axes[e.from].vertex!;
      const to = axes[e.to].vertex!;
      return `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"
        stroke="${COLOR.primary}" stroke-width="5" stroke-linecap="round"
        ${e.bridged ? 'stroke-dasharray="10 10"' : ""} />`;
    })
    .join("\n");

  const dotsSvg = vertexIndices
    .map((i) => {
      const v = axes[i].vertex!;
      return `<circle cx="${v.x.toFixed(1)}" cy="${v.y.toFixed(1)}" r="9" fill="${COLOR.primary}" stroke="${COLOR.background}" stroke-width="4" />`;
    })
    .join("\n");

  const labelGap = 34;
  const labelsSvg = axes
    .map((a) => {
      const pos = polarPoint(cx, radarCy, outerRadius + labelGap, a.angleDeg);
      const cosA = Math.cos(a.angleDeg * RADIAN);
      const anchor = cosA > 0.3 ? "start" : cosA < -0.3 ? "end" : "middle";
      const words = a.label.split(" ");
      const above = pos.y < radarCy;
      const firstDy = above ? -(words.length - 1) * 22 : 22;
      const tspans = words
        .map(
          (w, i) =>
            `<tspan x="${pos.x.toFixed(1)}" dy="${i === 0 ? firstDy : 22}">${escapeXml(w)}</tspan>`
        )
        .join("");
      return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="${anchor}" font-size="21" font-family="ui-monospace, monospace"
        fill="${a.scored ? COLOR.foreground : COLOR.mutedForeground}" font-style="${a.scored ? "normal" : "italic"}">${tspans}</text>`;
    })
    .join("\n");

  // ---- headline ---------------------------------------------------------
  const captionSvg =
    headline.basedOnDomains < n
      ? `<text x="${cx}" y="392" text-anchor="middle" font-size="22" fill="${COLOR.mutedForeground}">Based on ${headline.basedOnDomains} of ${n} areas</text>`
      : "";

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${COLOR.background}" />
  <text x="${cx}" y="96" text-anchor="middle" font-size="24" letter-spacing="3" font-family="ui-monospace, monospace" fill="${COLOR.mutedForeground}">[BRAND] COGNITIVE PERFORMANCE LAB</text>
  <text x="${cx}" y="260" text-anchor="middle" font-size="200" font-weight="700" font-family="ui-monospace, monospace" fill="${COLOR.foreground}">${headline.score}</text>
  <text x="${cx}" y="330" text-anchor="middle" font-size="44" font-weight="600" fill="${COLOR.primary}">${escapeXml(headline.band)}</text>
  ${captionSvg}
  ${spokesSvg}
  ${fillPathSvg}
  ${edgesSvg}
  ${dotsSvg}
  ${labelsSvg}
  <text x="${cx}" y="1010" text-anchor="middle" font-size="22" fill="${COLOR.mutedForeground}">A self-assessment of one sitting's performance —</text>
  <text x="${cx}" y="1040" text-anchor="middle" font-size="22" fill="${COLOR.mutedForeground}">not a medical test, and scores vary day to day.</text>
</svg>`;
}
