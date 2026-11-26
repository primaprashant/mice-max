/** Chevron navigation for the extra-night card row. The chevrons scroll the
 * track exactly one card at a time and disable at their ends. On connect,
 * the booked extra-night card (if any) moves to the front of the track, so
 * the user sees their booking first; without a booking the default order
 * stays. */
import { loadPlans } from "./plan-store";

class ExtraNightNav extends HTMLElement {
  connectedCallback() {
    const track = document.querySelector<HTMLElement>("[data-extra-night-track]");
    const prev = this.querySelector<HTMLButtonElement>("[data-extra-night-prev]");
    const next = this.querySelector<HTMLButtonElement>("[data-extra-night-next]");
    if (!track || !prev || !next) return;

    // Booked first: move the card whose experience has a plan to the start
    // of the track. Runs before the chevron math so offsets are fresh.
    const plans = loadPlans();
    if (plans.length > 0) {
      const cards = Array.from(track.querySelectorAll<HTMLElement>("extra-night-card"));
      const mine = cards.find((c) => plans.some((p) => p.ref_id === c.getAttribute("data-exp")));
      if (mine && mine !== cards[0]) track.insertBefore(mine, cards[0]);
    }

    const step = (dir: 1 | -1) => {
      // One card per click: find the card edge just past the current
      // scroll position in the given direction and scroll to it, so the
      // chevrons always land exactly on a card boundary.
      const cards = Array.from(track.querySelectorAll<HTMLElement>("extra-night-card"));
      const gap = 12;
      const offsets = cards.map((c) => c.offsetLeft);
      const target = dir === 1
        ? offsets.find((o) => o > track.scrollLeft + 2) ?? track.scrollWidth
        : [...offsets].reverse().find((o) => o < track.scrollLeft - 2) ?? 0;
      return Math.abs(target - track.scrollLeft) || (cards[0]?.offsetWidth ?? 288) + gap;
    };

    const update = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    };

    prev.addEventListener("click", () => {
      track.scrollBy({ left: -step(-1), behavior: "smooth" });
    });
    next.addEventListener("click", () => {
      track.scrollBy({ left: step(1), behavior: "smooth" });
    });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }
}

customElements.define("extra-night-nav", ExtraNightNav);
