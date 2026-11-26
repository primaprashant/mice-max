/** Live disruption panel: POST /find (steps 1-3), /replan (4), /write (5-6); steps reveal one by one. */
import { apiPost } from "./api";

type Step = {
  step: number; title_en: string; title_ja: string; summary_en: string; summary_ja: string; tool: string;
  model: string | null; ms: number | null; mode: "live" | "replay"; confidence: number | null;
  simulated: number; output: any;
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

function el(tag: string, cls = "", text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const fmt = (s: string, n: number | string) => s.replace("{n}", String(n));

function badge(text: string, strong: boolean) {
  return el("span", "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider "
    + (strong ? "bg-ink text-paper" : "border border-ink/20 text-ink-soft"), text);
}

function render(s: Step, lang: "en" | "ja", S: Record<string, string>): HTMLElement {
  const li = el("li", "rounded-lg border border-ink/10 px-4 py-3" + (reduced ? "" : " transition-opacity duration-300 opacity-0"));
  const head = el("div", "flex flex-wrap items-center gap-2");
  head.append(el("span", "font-mono text-xs text-ink-soft", String(s.step)),
    el("span", "text-sm font-semibold", lang === "ja" ? s.title_ja : s.title_en),
    badge(s.mode === "live" ? S.live : S.replay, s.mode === "live"));
  if (s.simulated && s.step === 1) head.append(badge(S.simulated, false));
  li.append(head);

  const meta = el("div", "mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-soft");
  meta.append(el("span", "", s.tool));
  if (s.model) meta.append(el("span", "", s.model));
  if (s.ms != null) meta.append(el("span", "", `${s.ms.toLocaleString()} ms`));
  if (s.confidence != null) meta.append(el("span", "", fmt(S.confidence, s.confidence.toFixed(2))));
  li.append(meta);

  const o = s.output || {};
  if (s.step === 1) {
    const box = el("div", "mt-2 rounded-md bg-theme-soft px-3 py-2 text-xs text-theme-strong");
    box.append(el("p", "break-words", o.ja), el("p", "mt-1 break-words text-ink-soft", o.en));
    li.append(box);
  } else if (s.step === 2) {
    const n = (o.affected || []).reduce((a: number, x: any) => a + (x.party_size || 1), 0);
    li.append(el("p", "mt-2 text-2xl font-semibold", fmt(S.affected, n)));
    li.append(el("p", "text-xs text-ink-soft", lang === "ja" ? s.summary_ja : s.summary_en));
  } else if (s.step === 4) {
    li.append(el("p", "mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft", S.replan));
    const ul = el("ul", "mt-1 space-y-3");
    for (const p of o.picks || []) {
      const item = el("li", "text-sm");
      const row = el("div", "flex flex-wrap items-center gap-x-2");
      const arrow = el("i", "ph ph-arrow-right text-xs text-ink-soft");
      arrow.setAttribute("aria-hidden", "true");
      row.append(el("s", "text-ink-soft", lang === "ja" ? p.from_title_ja : p.from_title_en), arrow,
        el("span", "font-medium", lang === "ja" ? p.to_title_ja : p.to_title_en));
      const facts = el("div", "mt-0.5 flex flex-wrap gap-x-4 font-mono text-[11px] text-ink-soft");
      if (p.people) facts.append(el("span", "", fmt(S.people, p.people)));
      if (p.confidence != null) facts.append(el("span", "", fmt(S.confidence, Number(p.confidence).toFixed(2))));
      item.append(row, facts, el("p", "mt-1 text-xs text-ink-soft", lang === "ja" ? p.why_ja : p.why_en));
      ul.append(item);
    }
    li.append(ul);
  } else if (s.step === 5) {
    li.append(el("p", "mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft", S.messages));
    const grid = el("div", "mt-1 grid grid-cols-1 gap-3 md:grid-cols-2");
    for (const m of o.messages || []) {
      const card = el("div", "min-w-0 rounded-lg border border-banana bg-banana-soft px-4 py-3");
      card.append(el("p", "whitespace-pre-line break-words text-sm", m.ja),
        el("p", "mt-2 whitespace-pre-line break-words text-xs text-ink-soft", m.en));
      grid.append(card);
    }
    li.append(grid);
  } else {
    li.append(el("p", "mt-1 text-xs text-ink-soft", lang === "ja" ? s.summary_ja : s.summary_en));
  }
  return li;
}

for (const root of document.querySelectorAll<HTMLElement>("[data-disruption-live]")) {
  const cid = root.dataset.conference!;
  const lang = root.dataset.lang as "en" | "ja";
  const S = JSON.parse(root.querySelector("[data-strings]")!.textContent || "{}");
  const btn = root.querySelector<HTMLButtonElement>("[data-run]")!;
  const label = root.querySelector<HTMLElement>("[data-run-label]")!;
  const list = root.querySelector<HTMLElement>("[data-steps]")!;
  const pending = root.querySelector<HTMLElement>("[data-pending]")!;
  const error = root.querySelector<HTMLElement>("[data-error]")!;

  async function reveal(steps: Step[]) {
    for (const s of steps) {
      const li = render(s, lang, S);
      list.append(li);
      requestAnimationFrame(() => li.classList.remove("opacity-0"));
      await wait(500);
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    list.replaceChildren();
    error.classList.add("hidden");
    pending.classList.remove("hidden");
    try {
      const found = await apiPost<{ run_id: string; steps: Step[] }>(`/api/disruption/${cid}/find`, {});
      await reveal(found.steps);
      const body = { run_id: found.run_id };
      await reveal((await apiPost<{ steps: Step[] }>(`/api/disruption/${cid}/replan`, body)).steps);
      await reveal((await apiPost<{ steps: Step[] }>(`/api/disruption/${cid}/write`, body)).steps);
    } catch {
      error.classList.remove("hidden");
    }
    pending.classList.add("hidden");
    label.textContent = S.again;
    btn.disabled = false;
  });
}
