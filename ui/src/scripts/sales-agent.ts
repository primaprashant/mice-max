/** /ops/sales: loads the rules-ranked pipeline and lets the sales agent draft outreach one by one. */
import { apiGet, apiPost } from "./api";

type Reason = { points: number; en: string; ja: string };
type Conf = {
  id: string; name_en: string; name_ja: string; start_date: string; end_date: string;
  attendees: number | null; attendees_kind: string | null; organizer: string | null; score: number; reasons: Reason[];
};
type Draft = {
  draft: { subject_ja: string; body_ja: string; subject_en: string; body_en: string; why_en: string; why_ja: string; confidence?: number };
  meta: { model: string; ms: number; tokens_in: number | null; tokens_out: number | null };
};

const RUN_COUNT = 5;

export function initSales(): void {
  const root = document.getElementById("sales");
  if (!root) return;
  const lang = root.dataset.lang === "ja" ? "ja" : "en";
  const s = JSON.parse(root.dataset.strings ?? "{}") as Record<string, string>;
  const tr = (k: string, vars: Record<string, string | number> = {}) =>
    (s[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? ""));
  const $ = (id: string) => document.getElementById(id)!;
  const status = $("sales-status"), progress = $("sales-progress"), queue = $("sales-queue");
  const rows = $("sales-rows"), runBtn = $("sales-run") as HTMLButtonElement;
  const liveTpl = $("sales-live") as HTMLTemplateElement;
  let confs: Conf[] = [];
  let busy = false;

  const el = (tag: string, cls = "", text = "") => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const name = (c: Conf) => (lang === "ja" ? c.name_ja : c.name_en);

  function renderRow(c: Conf): void {
    const row = el("tr", "border-t border-ink/10 align-top");
    row.append(el("td", "px-3 py-3 font-mono text-lg font-semibold tabular-nums", String(c.score)));
    const nameCell = el("td", "px-3 py-3");
    nameCell.append(el("div", "font-medium", name(c)));
    if (c.organizer) nameCell.append(el("div", "mt-0.5 text-xs text-ink-soft", c.organizer));
    row.append(nameCell);
    row.append(el("td", "whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums", `${c.start_date}\n${c.end_date}`));
    (row.lastElementChild as HTMLElement).style.whiteSpace = "pre";
    const size = el("td", "px-3 py-3 text-right tabular-nums", c.attendees ? c.attendees.toLocaleString() : tr("unknown"));
    row.append(size);
    const why = el("td", "min-w-[18rem] px-3 py-3");
    const ul = el("ul", "space-y-0.5 text-xs text-ink-soft");
    for (const r of c.reasons) {
      const li = el("li", "flex gap-2");
      li.append(el("span", "w-7 shrink-0 text-right font-mono tabular-nums text-ink", `+${r.points}`), el("span", "", lang === "ja" ? r.ja : r.en));
      ul.append(li);
    }
    why.append(ul);
    row.append(why);
    const act = el("td", "px-3 py-3 text-right");
    const btn = el("button", "min-h-11 whitespace-nowrap rounded-lg border border-ink/20 px-3 text-xs font-medium hover:bg-muted disabled:opacity-50", tr("draftOne")) as HTMLButtonElement;
    btn.type = "button";
    btn.dataset.draft = c.id;
    btn.addEventListener("click", () => draftOne(c));
    act.append(btn);
    row.append(act);
    const detail = el("tr", "hidden");
    detail.id = `sales-detail-${c.id}`;
    const cell = el("td", "px-3 pb-4") as HTMLTableCellElement;
    cell.colSpan = 6;
    detail.append(cell);
    rows.append(row, detail);
  }

  function email(title: string, subject: string, body: string): HTMLElement {
    const box = el("div", "min-w-0 rounded-lg border border-ink/10 bg-paper p-3");
    box.append(el("div", "text-[10px] font-semibold uppercase tracking-wider text-ink-soft", title));
    box.append(el("div", "mt-1 text-sm font-semibold", subject));
    box.append(el("p", "mt-2 whitespace-pre-wrap break-words text-sm", body));
    return box;
  }

  function showDraft(c: Conf, d: Draft): void {
    const cell = document.querySelector(`#sales-detail-${c.id} td`)!;
    cell.replaceChildren();
    const wrap = el("div", "rounded-xl bg-muted p-4");
    const head = el("div", "flex flex-wrap items-center gap-3");
    head.append(liveTpl.content.cloneNode(true));
    const metaGrid = el("dl", "grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4");
    const m = d.meta;
    const stat = (k: string, v: string) => {
      const g = el("div");
      g.append(el("dt", "text-ink-soft", tr(k)), el("dd", "font-mono tabular-nums", v));
      metaGrid.append(g);
    };
    stat("model", m.model);
    stat("time", `${(m.ms / 1000).toFixed(1)} s`);
    stat("tokens", `${m.tokens_in ?? "?"} / ${m.tokens_out ?? "?"}`);
    if (typeof d.draft.confidence === "number") stat("confidence", d.draft.confidence.toFixed(2));
    head.append(metaGrid);
    wrap.append(head);
    const why = el("p", "mt-3 text-sm");
    why.append(el("span", "font-semibold", `${tr("why")}: `), document.createTextNode(lang === "ja" ? d.draft.why_ja : d.draft.why_en));
    wrap.append(why);
    if (c.organizer) wrap.append(el("p", "mt-2 text-xs text-ink-soft", tr("to", { org: c.organizer })));
    const grid = el("div", "mt-2 grid gap-3 md:grid-cols-2");
    grid.append(email(tr("emailJa"), d.draft.subject_ja, d.draft.body_ja), email(tr("emailEn"), d.draft.subject_en, d.draft.body_en));
    wrap.append(grid);
    const approve = el("button", "mt-3 min-h-11 rounded-lg bg-theme px-4 text-sm font-semibold text-paper hover:bg-theme-strong disabled:bg-muted-strong disabled:text-ink", tr("approve")) as HTMLButtonElement;
    approve.type = "button";
    approve.addEventListener("click", () => { approve.disabled = true; approve.textContent = tr("approved"); });
    wrap.append(approve);
    cell.append(wrap);
  }

  function setQueueItem(li: HTMLElement | undefined, text: string): void {
    if (li) li.querySelector("[data-state]")!.textContent = text;
  }

  async function draftOne(c: Conf, li?: HTMLElement): Promise<boolean> {
    const detail = $(`sales-detail-${c.id}`);
    const btn = document.querySelector<HTMLButtonElement>(`[data-draft="${c.id}"]`);
    if (btn) btn.disabled = true;
    detail.classList.remove("hidden");
    detail.querySelector("td")!.replaceChildren(el("p", "animate-pulse text-sm text-ink-soft", tr("drafting")));
    setQueueItem(li, tr("drafting"));
    try {
      const d = await apiPost<Draft>("/api/sales/draft", { conference_id: c.id, lang });
      showDraft(c, d);
      setQueueItem(li, `${tr("drafted")}  ${(d.meta.ms / 1000).toFixed(1)} s`);
      return true;
    } catch {
      detail.querySelector("td")!.replaceChildren(el("p", "text-sm text-banana", tr("failed")));
      setQueueItem(li, tr("failed"));
      if (btn) btn.disabled = false;
      return false;
    }
  }

  async function run(): Promise<void> {
    if (busy) return;
    busy = true;
    runBtn.disabled = true;
    status.textContent = tr("running");
    const top = confs.slice(0, RUN_COUNT);
    queue.replaceChildren();
    const items = top.map((c) => {
      const li = el("li", "grid grid-cols-[2.5rem_1fr_auto] gap-3");
      li.append(el("span", "font-mono tabular-nums text-paper/60", String(c.score)), el("span", "truncate", name(c)));
      const st = el("span", "text-xs text-paper/60", tr("waiting"));
      st.dataset.state = "";
      li.append(st);
      queue.append(li);
      return li;
    });
    let done = 0;
    progress.textContent = tr("progress", { done, total: top.length });
    for (const [i, c] of top.entries()) {
      items[i].classList.add("text-banana-soft");
      if (await draftOne(c, items[i])) done++;
      items[i].classList.remove("text-banana-soft");
      progress.textContent = tr("progress", { done, total: top.length });
    }
    status.textContent = tr("count", { n: confs.length });
    runBtn.disabled = false;
    busy = false;
  }

  runBtn.addEventListener("click", run);
  apiGet<{ conferences: Conf[] }>("/api/sales/pipeline")
    .then((d) => {
      confs = d.conferences;
      confs.forEach(renderRow);
      status.textContent = tr("count", { n: confs.length });
      runBtn.disabled = false;
    })
    .catch(() => { status.textContent = tr("error"); });
}
