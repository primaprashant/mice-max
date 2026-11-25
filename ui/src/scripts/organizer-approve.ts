/** One-click remove on the organizer's suggestion lists. Approval is the
 * default (a suggestion not removed is approved); remove fades the row and
 * remembers the choice in localStorage for the session. */
const KEY = "micemax_removed";

function removed(): Set<string> {
  return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
}

class OrganizerWindow extends HTMLElement {
  connectedCallback() {
    const gone = removed();
    for (const row of this.querySelectorAll<HTMLElement>(".suggestion")) {
      const id = row.dataset.exp ?? "";
      if (gone.has(id)) {
        row.remove();
        continue;
      }
      const btn = row.querySelector<HTMLButtonElement>("button[data-action='remove']");
      btn?.addEventListener("click", () => {
        const cur = removed();
        cur.add(id);
        localStorage.setItem(KEY, JSON.stringify([...cur]));
        row.style.opacity = "0";
        window.setTimeout(() => row.remove(), 200);
      });
    }
  }
}

customElements.define("organizer-window", OrganizerWindow);
