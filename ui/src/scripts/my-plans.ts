/** Renders the attendee's own plans into the calendar grid, from the
 * plan-store (localStorage), so the grid updates after booking. Blocks use
 * the same overlap layout as the server-rendered blocks. */
import { loadPlans } from "./plan-store";

const MINUTES_PER_HOUR = 60;

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));
}

/** First column free at a block's start, same rule as DayGrid. */
function nextCol(usedCols: number[]): number {
  const used = [...usedCols].sort((a, b) => a - b);
  let col = 0;
  for (const u of used) {
    if (u === col) col++;
    else if (u > col) break;
  }
  return col;
}

interface LayoutPlan {
  start: string;
  end: string;
  title: string;
}

/** Cluster rule shared with DayGrid: cut the day at gaps, within a cluster
 * assign the first free column at each block's start, width = 1 / max cols. */
export function layoutPlans(plans: LayoutPlan[]): (LayoutPlan & { col: number; cols: number })[] {
  const sorted = [...plans].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out: (LayoutPlan & { col: number; cols: number })[] = [];
  let cluster: { plan: LayoutPlan; end: number; col: number }[] = [];
  let clusterEnd = -1;

  function flushCluster() {
    if (cluster.length === 0) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) out.push({ ...c.plan, col: c.col, cols });
    cluster = [];
    clusterEnd = -1;
  }

  for (const plan of sorted) {
    const startMin = toMinutes(plan.start);
    if (cluster.length > 0 && startMin >= clusterEnd) flushCluster();
    const col = nextCol(cluster.map((c) => c.col));
    cluster.push({ plan, end: toMinutes(plan.end), col });
    clusterEnd = Math.max(clusterEnd, toMinutes(plan.end));
  }
  flushCluster();
  return out;
}

class MyPlans extends HTMLElement {
  connectedCallback() {
    const day = this.getAttribute("data-day") ?? "";
    const gridStart = this.getAttribute("data-grid-start") ?? "00:00";
    const gridEnd = this.getAttribute("data-grid-end") ?? "23:00";
    const titles = JSON.parse(this.getAttribute("data-titles") ?? "{}") as Record<string, string>;

    const plans = loadPlans()
      .filter((p) => p.day === day)
      .map((p) => ({ start: p.start, end: p.end, title: titles[p.ref_id] ?? p.ref_id }));
    const gridStartMin = toMinutes(gridStart);
    const gridEndMin = toMinutes(gridEnd);
    const pos = (t: string) => ((toMinutes(t) - gridStartMin) / (gridEndMin - gridStartMin)) * 100;

    const blocks = layoutPlans(plans).map((p) => {
      const div = document.createElement("div");
      div.className = "absolute rounded-md bg-banana px-1.5 py-0.5";
      div.style.cssText = `top: ${pos(p.start)}%; height: ${pos(p.end) - pos(p.start)}%; left: ${p.col * (100 / p.cols) + 0.5}%; width: ${100 / p.cols - 1}%;`;
      const time = document.createElement("span");
      time.className = "block truncate font-mono text-[10px] tabular-nums opacity-80";
      time.textContent = p.start && p.end ? `${p.start}–${p.end}` : "";
      const title = document.createElement("span");
      title.className = "block truncate text-[11px] font-medium leading-tight";
      title.textContent = p.title;
      div.append(time, title);
      return div;
    });
    this.replaceChildren(...blocks);
  }
}

customElements.define("my-plans", MyPlans);
