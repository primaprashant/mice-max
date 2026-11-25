/** Renders the attendee's own plans into the calendar day, from the
 * plan-store (localStorage), so the calendar updates after booking. */
import { loadPlans } from "./plan-store";

function dayPlans(day: string): { start: string; end: string; title: string; status: string }[] {
  return loadPlans()
    .filter((p) => p.day === day)
    .map((p) => ({ start: p.start, end: p.end, title: p.ref_id, status: p.status }));
}

class MyPlans extends HTMLElement {
  connectedCallback() {
    const day = this.getAttribute("data-day") ?? "";
    const titles = JSON.parse(this.getAttribute("data-titles") ?? "{}") as Record<string, string>;
    const plans = dayPlans(day).map((p) => ({ ...p, title: titles[p.title] ?? p.title }));

    const rows = plans.map((p) => {
      const div = document.createElement("div");
      div.className = "rounded-lg bg-banana border-l-4 border-banana px-3 py-2";
      const time = document.createElement("span");
      time.className = "font-mono text-xs tabular-nums opacity-70";
      time.textContent = p.start && p.end ? `${p.start}–${p.end}` : "";
      const title = document.createElement("span");
      title.className = "ml-3 text-sm font-medium";
      title.textContent = p.title;
      div.append(time, title);
      return div;
    });
    this.replaceChildren(...rows);
  }
}

customElements.define("my-plans", MyPlans);
