/** The book/join button on the experience page. Free experiences join in
 * place; paid ones go through the dummy checkout, then come back booked.
 * Every join and booking also appends a row to the event log on the backend. */
import { loadPlans, planFor, putPlan, removePlan, type StoredPlan } from "./plan-store";
import { logEvent } from "./event-log";

class BookButton extends HTMLElement {
  connectedCallback() {
    const btn = this.querySelector("button") as HTMLButtonElement | null;
    if (!btn) return;
    const expId = btn.dataset.exp ?? "";
    const conf = btn.dataset.conf ?? "";
    const price = Number(btn.dataset.price ?? "0");
    const day = btn.dataset.day ?? "";
    const start = btn.dataset.start ?? "";
    const end = btn.dataset.end ?? "";
    const labels = JSON.parse(this.dataset.labels ?? "{}") as Record<string, string>;

    // Back from the mock checkout: turn the URL params into a booked plan,
    // then clean the query string so a reload does not add it again.
    const url = new URL(window.location.href);
    if (url.searchParams.get("booked") === "1" && !planFor(expId)) {
      putPlan({
        kind: "event",
        ref_id: expId,
        day,
        start,
        end,
        status: "booked",
        party_size: Number(url.searchParams.get("party") ?? "1") || 1,
      });
      logEvent("plan_booked", { experienceId: expId, partySize: Number(url.searchParams.get("party") ?? "1") || 1, priceJpy: price || null });
      document.dispatchEvent(new CustomEvent("micemax:plans-changed"));
      for (const key of ["booked", "day", "start", "end", "party"]) url.searchParams.delete(key);
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    const existing = planFor(expId);

    if (existing) {
      this.renderDone(btn, labels, existing.status, expId);
      return;
    }

    // One extra night per attendee: when this event is an extra night and
    // any other extra-night plan exists, block the button with the reason.
    if (btn.dataset.kind === "extra_night") {
      const plans = loadPlans();
      const otherNight = plans.find((p) => p.ref_id !== expId && this.isExtraNight(p.ref_id));
      if (otherNight) {
        this.renderBlocked(btn, labels);
        return;
      }
    }

    btn.addEventListener("click", () => {
      if (price > 0) {
        const params = new URLSearchParams({ exp: expId, conf, day, start, end, price: String(price) });
        window.location.href = `/checkout?${params}`;
        return;
      }
      const plan: StoredPlan = { kind: "event", ref_id: expId, day, start, end, status: "joined", party_size: 1 };
      putPlan(plan);
      logEvent("plan_joined", { experienceId: expId, partySize: 1, priceJpy: price || null });
      document.dispatchEvent(new CustomEvent("micemax:plans-changed"));
      this.renderDone(btn, labels, "joined", expId);
    });
  }

  renderDone(btn: HTMLButtonElement, labels: Record<string, string>, status: string, expId: string) {
    const label = status === "booked" ? labels.booked : labels.joined;
    btn.textContent = label ?? "✓";
    btn.classList.add("bg-banana-soft", "text-banana");
    btn.classList.remove("bg-theme", "text-paper");
    btn.setAttribute("disabled", "true");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = labels.cancel ?? "Cancel";
    cancel.className = "mt-2 w-full rounded-lg border border-ink/15 px-4 py-2 text-sm text-ink-soft transition-transform active:scale-[0.98]";
    cancel.addEventListener("click", () => {
      removePlan(expId);
      window.location.reload();
    });
    this.appendChild(cancel);
  }

  renderBlocked(btn: HTMLButtonElement, labels: Record<string, string>) {
    btn.textContent = labels.blocked ?? "You already have a booking at this time slot";
    btn.classList.add("bg-slate-100", "text-ink-soft");
    btn.classList.remove("bg-theme", "text-paper");
    btn.setAttribute("disabled", "true");
  }

  private isExtraNight(refId: string): boolean {
    return document.querySelectorAll(`extra-night-card[data-exp="${refId}"]`).length > 0;
  }
}

customElements.define("attendee-book", BookButton);
