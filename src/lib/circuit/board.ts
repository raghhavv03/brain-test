/**
 * Circuit (Trail-Making B) skeleton — fixed science. 16 nodes, alternating
 * number/letter, ascending: 1-A-2-B-...-8-H. Do not change the sequence,
 * node count, or placement density to make the task easier/harder.
 */
export const SEQUENCE = [
  "1", "A", "2", "B", "3", "C", "4", "D",
  "5", "E", "6", "F", "7", "G", "8", "H",
] as const;

export type NodeId = (typeof SEQUENCE)[number];

export type CircuitNode = { id: NodeId; x: number; y: number };

export const BOARD = { width: 600, height: 400 };

const SPAWN_MARGIN = 40; // keep node centers away from the board edges
const MIN_GAP = 70; // min center-to-center separation, so tap targets don't crowd

export function createBoard(): CircuitNode[] {
  const positions: { x: number; y: number }[] = [];
  let attempts = 0;
  while (positions.length < SEQUENCE.length) {
    // Practically unreachable at this density, but never loop unbounded on
    // an unlucky layout — throw away the partial placement and start over.
    if (++attempts > 5000) {
      positions.length = 0;
      attempts = 0;
    }
    const x = SPAWN_MARGIN + Math.random() * (BOARD.width - SPAWN_MARGIN * 2);
    const y = SPAWN_MARGIN + Math.random() * (BOARD.height - SPAWN_MARGIN * 2);
    if (positions.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_GAP)) {
      continue;
    }
    positions.push({ x, y });
  }
  return SEQUENCE.map((id, i) => ({ id, x: positions[i].x, y: positions[i].y }));
}
