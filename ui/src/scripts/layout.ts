/** Shared overlap layout for calendar blocks. Cut the day into clusters of
 * overlapping blocks; within a cluster each block takes the first column
 * whose block has ended by its start (a column frees when its events end);
 * the cluster's column count is the number of columns opened in it, so each
 * block spans width / count, offset by column. Used by both DayGrid.astro
 * (server) and my-plans.ts (client) so their blocks line up. */

export interface LayoutBlock {
  start: string; // "HH:MM"
  end: string;
}

export interface PlacedBlock {
  col: number;
  cols: number;
}

const MINUTES_PER_HOUR = 60;

export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));
}

export function layoutBlocks<T extends LayoutBlock>(blocks: T[]): (T & PlacedBlock)[] {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out: (T & PlacedBlock)[] = [];
  let cluster: { block: T; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  function flushCluster() {
    if (cluster.length === 0) return;
    for (const c of cluster) out.push({ ...c.block, col: c.col, cols: colEnds.length });
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  }

  for (const block of sorted) {
    const startMin = toMinutes(block.start);
    if (cluster.length > 0 && startMin >= clusterEnd) flushCluster();
    let col = colEnds.findIndex((end) => end <= startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(toMinutes(block.end));
    } else {
      colEnds[col] = Math.max(colEnds[col], toMinutes(block.end));
    }
    cluster.push({ block, col });
    clusterEnd = Math.max(clusterEnd, toMinutes(block.end));
  }
  flushCluster();
  return out;
}
