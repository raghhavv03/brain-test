/**
 * Vertex/edge selection for a radar polygon drawn over a fixed ring of N
 * axis slots where only some slots have a real (scored) value. Pure index
 * math — no coordinates — so both the on-screen Recharts radar
 * (domain-radar.tsx) and the share-card's plain-SVG mini radar can turn
 * "which axes are scored" into the same fill polygon and edge list, then
 * each resolve those indices to whatever {x, y} their own rendering
 * pipeline produces (Recharts' internal scale vs. a fixed-size share-card
 * canvas).
 *
 * An edge between two scored vertices that aren't adjacent in axis order
 * skips over one or more unscored axes; that edge is "bridged" and should
 * be drawn dashed rather than solid, since it asserts no measurement along
 * that stretch — never a smooth interpolation across missing data.
 */

export type RadarEdge = { from: number; to: number; bridged: boolean };

export function radarPolygon(scoredFlags: boolean[]): {
  vertexIndices: number[];
  edges: RadarEdge[];
  hasFill: boolean;
} {
  const n = scoredFlags.length;
  const vertexIndices = scoredFlags
    .map((scored, i) => (scored ? i : -1))
    .filter((i) => i !== -1);

  const edges: RadarEdge[] = [];
  if (vertexIndices.length === 2) {
    const [a, b] = vertexIndices;
    const gap = Math.min((b - a) % n, (a - b + n) % n);
    edges.push({ from: a, to: b, bridged: gap > 1 });
  } else if (vertexIndices.length >= 3) {
    for (let j = 0; j < vertexIndices.length; j++) {
      const a = vertexIndices[j];
      const b = vertexIndices[(j + 1) % vertexIndices.length];
      const gap = (b - a + n) % n;
      edges.push({ from: a, to: b, bridged: gap > 1 });
    }
  }

  return { vertexIndices, edges, hasFill: vertexIndices.length >= 3 };
}
