/** Tag filters above the plan suggestion cards. Single-select: one active
 * tag at a time; the "All" chip on the far left resets to every card, and
 * clicking the active tag chip clears it too. UI-side only, no API calls;
 * the cards carry their tags in data-tags. After filtering, the scroll
 * position is re-anchored to the section so hiding cards does not yank the
 * page. */
const ACTIVE_CLASSES = ["border-theme", "bg-theme-soft", "text-theme-strong"];

class PlanFilters extends HTMLElement {
  connectedCallback() {
    const chips = this.querySelectorAll<HTMLButtonElement>("[data-plan-filter]");
    const allChip = this.querySelector<HTMLButtonElement>("[data-plan-filter-all]");
    if (chips.length === 0 || !allChip) return;

    const cards = Array.from(this.querySelectorAll<HTMLElement>("[data-tags]"));
    const empty = this.querySelector<HTMLElement>("[data-filter-empty]");

    const setActive = (chip: HTMLButtonElement | null) => {
      for (const c of [allChip, ...chips]) {
        const on = c === chip;
        c.setAttribute("aria-pressed", on ? "true" : "false");
        for (const cls of ACTIVE_CLASSES) c.classList.toggle(cls, on);
      }
    };

    allChip.addEventListener("click", () => {
      setActive(null);
      applyFilter();
    });

    for (const chip of chips) {
      chip.addEventListener("click", () => {
        const wasActive = chip.getAttribute("aria-pressed") === "true";
        setActive(wasActive ? null : chip);
        applyFilter();
      });
    }

    function applyFilter() {
      // Anchor the viewport to this section before the reflow: hiding cards
      // shrinks the document and the browser would otherwise clamp the
      // scroll position and yank the page up.
      const anchor = document.querySelector<HTMLElement>("[data-day-panel]:not(.hidden) [data-plan-filters-top]");
      const before = anchor?.getBoundingClientRect().top ?? 0;
      const scrollY = window.scrollY;

      const active = Array.from(chips).find((c) => c.getAttribute("aria-pressed") === "true")?.dataset.planFilter ?? "";
      let visible = 0;
      for (const card of cards) {
        const tags = (card.dataset.tags ?? "").split(" ").filter(Boolean);
        const match = active === "" || tags.includes(active);
        card.classList.toggle("hidden", !match);
        if (match) visible++;
      }
      if (empty) empty.classList.toggle("hidden", visible > 0);

      if (anchor) {
        const after = anchor.getBoundingClientRect().top;
        window.scrollTo({ top: scrollY + (after - before), behavior: "instant" as ScrollBehavior });
      }
    }
  }
}

customElements.define("plan-filters", PlanFilters);
