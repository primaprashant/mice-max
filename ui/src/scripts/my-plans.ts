/** Renders the attendee's own plans into the calendar grid, from the
 * plan-store (localStorage), so the grid updates after booking. Blocks span
 * the full grid width, like the free-time windows they sit in. */
import { loadPlans } from "./plan-store";

const MINUTES_PER_HOUR = 60;

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));
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

    const blocks = plans.map((p) => {
      const div = document.createElement("div");
      div.className = "absolute rounded-md bg-banana px-1.5 py-0.5";
      div.style.cssText = `top: ${pos(p.start)}%; height: ${pos(p.end) - pos(p.start)}%; left: 0.5%; width: 99%;`;
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
