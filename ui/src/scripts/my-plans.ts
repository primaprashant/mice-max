/** Renders the attendee's own plans into the calendar grid, from the
 * plan-store (localStorage), so the grid updates after booking. Blocks span
 * the full grid width, like the free-time windows they sit in. */
import { loadPlans } from "./plan-store";
import { toMinutes } from "./layout";

class MyPlans extends HTMLElement {
  connectedCallback() {
    const day = this.getAttribute("data-day") ?? "";
    const gridStart = this.getAttribute("data-grid-start") ?? "00:00";
    const gridEnd = this.getAttribute("data-grid-end") ?? "23:00";
    let titles: Record<string, string> = {};
    try {
      titles = JSON.parse(this.getAttribute("data-titles") ?? "{}") as Record<string, string>;
    } catch {
      titles = {};
    }

    const plans = loadPlans()
      .filter((p) => p.day === day)
      .map((p) => ({ start: p.start, end: p.end, title: titles[p.ref_id] ?? p.ref_id }));
    const gridStartMin = toMinutes(gridStart);
    const gridEndMin = toMinutes(gridEnd);
    const pos = (t: string) => ((toMinutes(t) - gridStartMin) / (gridEndMin - gridStartMin)) * 100;

    const blocks = plans.map((p) => {
      const top = Math.max(0, pos(p.start));
      const bottom = Math.min(100, pos(p.end));
      if (bottom <= top) return null; // plan sits outside the grid range
      const div = document.createElement("div");
      div.className = "absolute rounded-md bg-banana-soft border border-banana px-1.5 py-0.5";
      div.style.cssText = `top: ${top}%; height: ${bottom - top}%; left: 0.5%; width: 99%;`;
      const time = document.createElement("span");
      time.className = "block truncate font-mono text-[10px] tabular-nums opacity-80";
      time.textContent = p.start && p.end ? `${p.start}–${p.end}` : "";
      const title = document.createElement("span");
      title.className = "block truncate text-[11px] font-medium leading-tight";
      title.textContent = p.title;
      div.append(time, title);
      return div;
    });
    this.replaceChildren(...blocks.filter((b) => b !== null));
  }
}

customElements.define("my-plans", MyPlans);
