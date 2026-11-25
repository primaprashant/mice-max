/** Grays out the suggestion cards whose experience the attendee has
 * booked, with a "Booked" pill — the same treatment as the extra-night
 * banner cards. Day scoping follows the booking semantics:
 * - extra night: one booking closes the whole set (unique one-night event),
 *   so every extra-night card grays regardless of day;
 * - repeatable experiences: the booking is for a specific day, so only the
 *   card in that day's panel grays; other days stay bookable.
 * The conference id comes from the URL; the window id on each card maps to
 * its day. Re-runs on booking changes. */
import { loadPlans } from "./plan-store";

class PlanState extends HTMLElement {}

/** Experience ids on this page that are extra nights, from the banner. */
function extraNightIds(): Set<string> {
  return new Set(
    [...document.querySelectorAll<HTMLElement>("extra-night-card[data-exp]")].map((c) => c.getAttribute("data-exp") ?? ""),
  );
}

function markBookedCards() {
  const plans = loadPlans().filter((p) => p.status === "booked");
  if (plans.length === 0) return;
  const xn = extraNightIds();
  // window id -> day, from any card's window marker on the page
  const winDay = new Map<string, string>();
  for (const card of document.querySelectorAll<HTMLElement>("[data-suggest-window]")) {
    const day = card.closest("[data-day-panel]")?.getAttribute("data-day-panel") ?? "";
    winDay.set(card.getAttribute("data-suggest-window") ?? "", day);
  }
  for (const plan of plans) {
    for (const card of document.querySelectorAll<HTMLElement>(`[data-suggest="${plan.ref_id}"]`)) {
      const isExtraNight = xn.has(plan.ref_id);
      const cardDay = card.closest("[data-day-panel]")?.getAttribute("data-day-panel") ?? "";
      if (!isExtraNight && cardDay !== plan.day) continue;
      card.classList.add("opacity-75", "border-ink/20", "bg-slate-100");
      card.classList.remove("border-banana", "bg-banana-soft");
      if (card.dataset.planState === "1") continue;
      card.dataset.planState = "1";
      const badge = document.createElement("span");
      badge.className = "rounded-full border border-banana bg-banana-soft px-2 py-0.5 text-[11px] font-medium text-banana-ink";
      badge.textContent = card.getAttribute("data-booked-label") ?? "Booked";
      const title = card.querySelector(".text-sm.font-semibold");
      title?.after(badge);
    }
  }
}

customElements.define("plan-state", PlanState);
markBookedCards();
document.addEventListener("micemax:plans-changed", markBookedCards);
