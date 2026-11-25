/** The "Stay the extra night" banner cards. One card per extra-night
 * experience. When the attendee has any extra-night plan, every card grays
 * out; the booked one also shows its status badge. Unbooked cards stay
 * clickable. Content stays exactly as rendered; only styling changes.
 * Deferring the dispatch by a frame: the cards upgrade before day-tabs
 * attaches its document-level listener, so an immediate dispatch is lost. */
import { loadPlans } from "./plan-store";

const STATUS_LABELS: Record<string, string> = {
  saved: "data-label-saved",
  joined: "data-label-joined",
  booked: "data-label-booked",
};

class ExtraNightCard extends HTMLElement {
  connectedCallback() {
    const expId = this.getAttribute("data-exp") ?? "";
    const link = this.querySelector("a");
    if (!expId || !link) return;
    // The nav reorders cards with insertBefore, which re-fires this
    // callback; a badge from a previous run is already in place.
    if (this.dataset.done === "1") return;
    this.dataset.done = "1";

    const plans = loadPlans();
    // Any plan on an extra-night experience grays the whole set: the
    // attendee stays one night, so booking one closes the others.
    const anyPlan = plans.find((p) => document.querySelector(`extra-night-card[data-exp="${p.ref_id}"]`));
    if (!anyPlan) return;

    // Gray out: slate background, muted border, dimmed.
    link.classList.add("opacity-75", "border-ink/20", "bg-slate-100");
    link.classList.remove("border-banana", "bg-banana-soft");

    if (anyPlan.ref_id === expId) {
      const label = this.getAttribute(STATUS_LABELS[anyPlan.status] ?? "data-label-booked") ?? "";
      const badge = document.createElement("span");
      // Banana yellow: the MiceMax data-category color, same as the event
      // tint, so the booked card reads as "this one is yours".
      badge.className = "rounded-full border border-banana bg-banana-soft px-2 py-0.5 text-[11px] font-medium text-banana-ink";
      badge.textContent = label;
      link.querySelector("h3")?.after(badge);

      // Reveal the stay-over day as its own tab, with the plan's window
      // for the day header.
      requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent("micemax:extra-night-booked", { detail: { day: anyPlan.day, start: anyPlan.start, end: anyPlan.end } }));
      });
    }
  }
}

customElements.define("extra-night-card", ExtraNightCard);
