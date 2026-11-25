/** Day tabs on the attendee calendar: one panel visible at a time.
 * Server picks the default (today inside the dates, else Day 1); this only
 * toggles visibility and the pressed styling. Plain toggle buttons with
 * aria-pressed, not a tab pattern: three panels do not need arrow keys.
 * When the attendee books the extra night, the stay-over day joins as its
 * own tab after the conference days, labeled "Day N" with date and weekday.
 * The synthetic tab routes through the same select() as the server tabs,
 * so exactly one tab is active at any time. */
class DayTabs extends HTMLElement {
  private select(tab: HTMLButtonElement) {
    const day = tab.dataset.dayTab ?? "";
    for (const t of this.querySelectorAll<HTMLButtonElement>("[data-day-tab]")) {
      const on = t === tab;
      t.setAttribute("aria-pressed", on ? "true" : "false");
      t.classList.toggle("bg-ink", on);
      t.classList.toggle("text-paper", on);
      t.classList.toggle("border-ink", on);
      t.classList.toggle("border-ink/25", !on);
      t.classList.toggle("text-ink-soft", !on);
      t.classList.toggle("hover:bg-ink/5", !on);
    }
    for (const p of this.querySelectorAll<HTMLElement>("[data-day-panel]")) p.classList.toggle("hidden", p.dataset.dayPanel !== day);
  }

  connectedCallback() {
    for (const tab of this.querySelectorAll<HTMLButtonElement>("[data-day-tab]")) {
      tab.addEventListener("click", () => this.select(tab));
    }

    // The extra-night stay-over day joins as its own tab after the
    // conference days once a plan books the night: the day after the last
    // program day, with an empty program grid that carries the booked
    // plan's block.
    document.addEventListener("micemax:extra-night-booked", (e) => {
      const detail = (e as CustomEvent).detail as { day?: string; start?: string; end?: string } | undefined;
      if (!detail?.day) return;
      // Stay-over = the day after the booked extra-night window's day.
      const stay = new Date(Date.parse(detail.day + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
      if (this.querySelector<HTMLButtonElement>(`[data-day-tab="${stay}"]`)) return;

      const tabRow = this.querySelector<HTMLElement>("[data-day-tab-row]");
      const n = this.querySelectorAll<HTMLButtonElement>("[data-day-tab]").length + 1;
      const date = new Date(stay + "T00:00:00Z");
      const lang = document.documentElement.lang === "ja" ? "ja-JP" : "en-US";
      const weekday = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const label =
        lang === "ja-JP"
          ? `${n}日目 (${stay.slice(5).replace("-", "/")} ${date.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" })})`
          : `Day ${n} (${stay.slice(5).replace("-", "/")}, ${weekday})`;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.dayTab = stay;
      tab.setAttribute("aria-pressed", "false");
      tab.className = "w-full rounded-md border border-ink/25 px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5";
      tab.textContent = label;
      tab.addEventListener("click", () => this.select(tab));
      tabRow?.appendChild(tab);

      // The stay-over panel: an empty day whose grid carries the booked
      // plan's block. The plan is stored under the window's day (the night
      // starts that day), so my-plans' day filter would miss it here; the
      // block is rendered directly at the plan's time instead. The grid
      // keeps the same chrome as the server grids: hour labels every 30
      // minutes' slot, half-hour lines, sticky gutter and header.
      const planLine = detail.start && detail.end ? `${detail.day.slice(5).replace("-", "/")} ${detail.start}–${detail.end}` : "";
      const titlesAttr = this.querySelector<HTMLElement>("my-plans")?.getAttribute("data-titles") ?? "{}";
      // Same fixed range as the server grids: 06:00 to 24:00.
      const HOUR_REM = 3;
      const START_HOUR = 6;
      const HOURS = 18;
      const labels: string[] = [];
      for (let h = START_HOUR; h <= START_HOUR + HOURS; h++) labels.push(`${String(h % 24).padStart(2, "0")}:00`);
      const gutterLabels = labels
        .map((l, i) => `<span class="absolute right-2 -translate-y-1/2 font-mono text-[11px] tabular-nums text-ink-soft" style="top: ${(i / labels.length) * 100}%">${l}</span>`)
        .join("");
      const lines = labels
        .map((_, i) => `<div class="absolute inset-x-0 border-t border-ink/5" style="top: ${(i / labels.length) * 100}%"></div>`)
        .join("");
      const panel = document.createElement("div");
      panel.dataset.dayPanel = stay;
      panel.className = "mt-6 hidden";
      panel.innerHTML = `
        <div class="mb-2 flex justify-end">
          ${planLine ? `<p class="font-mono text-xs tabular-nums text-ink-soft">${planLine}</p>` : ""}
        </div>
        <div class="overflow-x-auto">
          <div class="grid grid-cols-[3.5rem_1fr] text-xs" data-day-grid data-grid-start="06:00" data-grid-end="24:00">
            <div class="sticky left-0 z-[400] bg-paper">
              <div class="h-9"></div>
              <div class="relative" style="height: ${HOURS * HOUR_REM}rem">${gutterLabels}</div>
            </div>
            <div class="min-w-0">
              <div class="sticky top-0 z-[300] flex h-9 bg-paper">
                <div class="flex-1 border-b border-ink/10 px-2 py-2 text-[11px] font-semibold text-ink"></div>
              </div>
              <div class="relative border-l border-ink/10" style="height: ${HOURS * HOUR_REM}rem">
                ${lines}
                <my-plans data-day="${detail.day}" data-grid-start="06:00" data-grid-end="24:00" data-titles="${titlesAttr.replace(/"/g, "&quot;")}"></my-plans>
              </div>
            </div>
          </div>
        </div>
      `;
      this.appendChild(panel);
      document.dispatchEvent(new CustomEvent("micemax:blocks-changed"));
    });
  }
}

customElements.define("day-tabs", DayTabs);
