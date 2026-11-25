/** Session detail modal. Grid blocks carry data-session-id and open the
 * dialog when clicked; the details come from one JSON payload rendered on
 * the page. Keyboard: Escape closes, backdrop click closes. */
const SESSIONS_KEY = "data-sessions-json";

interface SessionDetail {
  title: string;
  time: string;
  type: string;
  track: string | null;
  room: string | null;
  fee: string | null;
}

class SessionModal extends HTMLElement {
  private dialog: HTMLDialogElement | null = null;
  private sessions = new Map<string, SessionDetail>();

  connectedCallback() {
    const raw = this.getAttribute(SESSIONS_KEY);
    if (raw) {
      try {
        for (const [id, detail] of Object.entries(JSON.parse(raw) as Record<string, SessionDetail>)) {
          this.sessions.set(id, detail);
        }
      } catch {
        // no payload, no modal
      }
    }

    this.dialog = document.createElement("dialog");
    this.dialog.className = "session-modal";
    this.appendChild(this.dialog);

    // Backdrop click closes: a click on the dialog itself (not children) is
    // the padding area.
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.dialog!.close();
    });

    document.querySelectorAll<HTMLElement>("[data-session-id]").forEach((block) => {
      block.addEventListener("click", () => this.open(block.dataset.sessionId ?? ""));
      block.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.open(block.dataset.sessionId ?? "");
        }
      });
    });
  }

  private open(id: string) {
    const detail = this.sessions.get(id);
    const dialog = this.dialog;
    if (!detail || !dialog) return;
    // Re-render both children: the card, then the click-anywhere hint.
    const hint = document.createElement("p");
    hint.className = "px-5 pb-4 text-center text-xs";
    hint.style.color = "rgb(248 250 252 / 0.9)";
    hint.textContent = this.getAttribute("data-hint-label") ?? "";
    dialog.replaceChildren(this.renderDetail(detail), hint);
    dialog.showModal();
  }

  private renderDetail(d: SessionDetail): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "relative p-5";
    const h = document.createElement("h2");
    h.className = "text-base font-semibold leading-snug";
    h.textContent = d.title;
    const time = document.createElement("p");
    time.className = "mt-2 font-mono text-xs tabular-nums text-ink-soft";
    time.textContent = d.time;
    const meta = document.createElement("p");
    meta.className = "mt-1 text-xs text-ink-soft";
    meta.textContent = [d.type, d.track, d.room].filter(Boolean).join(" · ");
    const parts: HTMLElement[] = [h, time, meta];
    if (d.fee) {
      const fee = document.createElement("p");
      fee.className = "mt-2 text-xs font-medium";
      fee.textContent = d.fee;
      parts.push(fee);
    }
    wrap.append(...parts);
    // Close affordance: an × icon button, 44px touch target, keyboard
    // reachable. Label from the page for the language in use.
    const close = document.createElement("button");
    close.className = "absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink";
    close.setAttribute("aria-label", this.getAttribute("data-close-label") ?? "Close");
    close.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    close.addEventListener("click", () => this.dialog!.close());
    wrap.appendChild(close);
    return wrap;
  }
}

customElements.define("session-modal", SessionModal);
