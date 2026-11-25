/** Tag filters above the plan suggestion cards. Single-select: one active
 * tag at a time, clicking the active chip clears it. UI-side only, no API
 * calls; the cards carry their tags in data-tags. After filtering, the
 * scroll position is re-anchored to the section so hiding cards does not
 * yank the page. */
const ACTIVE_CLASSES = ["border-theme", "bg-theme-soft", "text-theme-strong"];

class PlanFilters extends HTMLElement {
  connectedCallback() {
    const chips = this.querySelectorAll<HTMLButtonElement>("[data-plan-filter]");
    if (chips.length === 0) return;

    const cards = Array.from(this.querySelectorAll<HTMLElement>("[data-tags]"));
    const empty = this.querySelector<HTMLElement>("[data-filter-empty]");

    for (const chip of chips) {
      chip.addEventListener("click", () => {
        const wasActive = chip.getAttribute("aria-pressed") === "true";
        // Single-select: clear every chip, then activate this one (or none
        // when it was the active one).
        for (const c of chips) {
          c.setAttribute("aria-pressed", "false");
          for (const cls of ACTIVE_CLASSES) c.classList.remove(cls);
        }
        if (!wasActive) {
          chip.setAttribute("aria-pressed", "true");
          for (const cls of ACTIVE_CLASSES) chip.classList.add(cls);
        }
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
