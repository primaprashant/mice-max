/** Day tabs on the attendee calendar: one panel visible at a time.
 * Server picks the default (today inside the dates, else Day 1); this only
 * toggles visibility and tab styling. */
class DayTabs extends HTMLElement {
  connectedCallback() {
    const tabs = this.querySelectorAll<HTMLButtonElement>("[data-day-tab]");
    const panels = this.querySelectorAll<HTMLElement>("[data-day-panel]");

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const day = tab.dataset.dayTab ?? "";
        for (const t of tabs) {
          const on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.classList.toggle("bg-ink", on);
          t.classList.toggle("text-paper", on);
          t.classList.toggle("text-ink-soft", !on);
          t.classList.toggle("hover:bg-ink/5", !on);
        }
        for (const p of panels) p.classList.toggle("hidden", p.dataset.dayPanel !== day);
      });
    }
  }
}

customElements.define("day-tabs", DayTabs);
