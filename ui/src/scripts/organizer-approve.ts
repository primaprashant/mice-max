/** One-click remove on the organizer's suggestion cards. Approval is the
 * default (a suggestion not removed is approved); remove fades the card and
 * remembers the choice in localStorage for the session. Document-level
 * delegation: the cards live in per-day panels, no wrapper element needed. */
const KEY = "micemax_removed";

function removed(): Set<string> {
  return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
}

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action='remove']");
  if (!btn) return;
  const row = btn.closest<HTMLElement>(".suggestion");
  const id = row?.dataset.exp;
  if (!row || !id) return;
  const cur = removed();
  cur.add(id);
  localStorage.setItem(KEY, JSON.stringify([...cur]));
  row.style.opacity = "0";
  window.setTimeout(() => row.remove(), 200);
});
