/** Control room (/ops): renders the agent org chart and KPIs from /api/ops/agents,
 * and the activity feed: live rows from /api/ops/live (polled every 3 s) above the
 * replay rows the server embedded. If the backend is asleep, it retries quietly. */
import { apiGet } from "./api";

interface Row {
  id: string;
  conference_id: string;
  ts: string;
  agent: string;
  title_en: string;
  title_ja: string;
  model: string | null;
  ms: number | null;
  mode: "live" | "replay";
  handed_to_human: number;
}
interface Agent {
  id: string;
  role_en: string;
  role_ja: string;
  tool: string;
  model: string | null;
  link: string;
  mode: "live" | "replay" | "next";
  replay_runs: number;
  live_runs: number;
  tokens: number;
}
interface Agents {
  departments: { id: string; agents: Agent[] }[];
  humans: { count: number; role_en: string; role_ja: string }[];
  totals: { agents: number; replay_steps: number; live_steps: number; handoffs: number };
  cost: { per_conference_jpy: number | null; conferences_measured: number; jpy_per_usd: number };
}

const data = JSON.parse(document.getElementById("control-data")!.textContent!);
const lang: "en" | "ja" = data.lang;
const S: Record<string, string> = data.strings;
const fmt = new Intl.NumberFormat(lang === "ja" ? "ja-JP" : "en-US");
const s = (key: string, vars: Record<string, string | number> = {}) =>
  S[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

function el(tag: string, cls = "", text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function modeLabel(mode: string): HTMLElement {
  const base = "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider";
  if (mode === "live") return el("span", `${base} bg-ink text-paper`, S.live);
  if (mode === "next") return el("span", `${base} border border-dashed border-ink/30 text-ink-soft`, S.next);
  return el("span", `${base} border border-ink/20 text-ink-soft`, S.replay);
}

// --- KPIs and org chart -------------------------------------------------------

let liveCount = 0;
let agentsData: Agents | null = data.agents;

function setKpi(id: string, text: string) {
  const e = document.querySelector(`[data-kpi="${id}"]`);
  if (e) e.textContent = text;
}

function renderKpis() {
  const t = agentsData?.totals;
  const live = Math.max(liveCount, t?.live_steps ?? 0);
  setKpi("agents", t ? fmt.format(t.agents) : "");
  setKpi("steps", fmt.format((t?.replay_steps ?? data.replayTotals.steps) + live));
  setKpi("live", fmt.format(live));
  setKpi("handoffs", fmt.format(t?.handoffs ?? data.replayTotals.handoffs));
  const cost = agentsData?.cost;
  const costEl = document.querySelector<HTMLElement>('[data-kpi="cost"]')!;
  if (cost?.per_conference_jpy != null) {
    costEl.className = "mt-1 font-mono text-2xl font-semibold tabular-nums";
    costEl.textContent = `~¥${fmt.format(cost.per_conference_jpy)}`;
    document.querySelector("[data-cost-basis]")!.textContent =
      s("costBasis", { rate: cost.jpy_per_usd, n: cost.conferences_measured });
  } else {
    costEl.textContent = S.kpiCostPending;
    costEl.className = "mt-1 text-sm font-medium";
  }
}

function agentCard(a: Agent): HTMLElement {
  const card = el("a", "group flex min-h-11 flex-col gap-1 rounded-lg border border-ink/10 bg-paper p-3 transition-colors hover:border-ink/30") as HTMLAnchorElement;
  card.href = a.link;
  if (a.mode === "next") card.classList.add("border-dashed");
  const top = el("div", "flex items-center justify-between gap-2");
  top.append(el("span", "font-mono text-xs font-semibold", a.id), modeLabel(a.mode));
  const role = el("p", "text-sm leading-snug", lang === "ja" ? a.role_ja : a.role_en);
  const meta = el("p", "mt-auto flex flex-wrap gap-x-3 font-mono text-[11px] text-ink-soft");
  meta.append(el("span", "", a.model ? a.model.replace(/^anthropic\//, "") : a.tool === "rules" ? S.rules : a.tool));
  const runs = a.replay_runs + a.live_runs;
  if (runs) meta.append(el("span", "tabular-nums", s("runs", { n: fmt.format(runs) })));
  if (a.tokens) meta.append(el("span", "tabular-nums", s("tokens", { n: fmt.format(a.tokens) })));
  card.append(top, role, meta);
  return card;
}

function renderOrg() {
  if (!agentsData) return;
  const root = document.querySelector("[data-org]")!;
  root.replaceChildren();
  for (const d of agentsData.departments) {
    const sec = el("div");
    const head = el("div", "flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-1");
    head.append(el("h3", "font-semibold", S[`dept.${d.id}`]), el("p", "text-xs text-ink-soft", S[`deptNote.${d.id}`]));
    const grid = el("div", "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3");
    grid.append(...d.agents.map(agentCard));
    sec.append(head, grid);
    root.append(sec);
  }
  const humans = el("div", "rounded-lg bg-banana-soft p-3");
  humans.append(el("h3", "text-xs font-semibold uppercase tracking-wide", S.humans));
  for (const h of agentsData.humans) {
    const p = el("p", "mt-1 text-sm");
    p.append(el("span", "font-mono font-semibold", s("person", { n: h.count })), document.createTextNode(` ${lang === "ja" ? h.role_ja : h.role_en}`));
    humans.append(p);
  }
  root.append(humans);
}

async function loadAgents() {
  try {
    agentsData = await apiGet<Agents>("/api/ops/agents");
    renderOrg();
    renderKpis();
    setTimeout(loadAgents, 30_000);
  } catch {
    setTimeout(loadAgents, agentsData ? 30_000 : 5_000);
  }
}

// --- activity feed -------------------------------------------------------------

const feed = document.querySelector("[data-feed]")!;
const seen = new Set<string>();
let lastTs: string | undefined;
let waiting: HTMLElement | null = null;

function feedRow(r: Row, fresh: boolean): HTMLElement {
  const li = el("li", "rounded-lg border border-ink/10 bg-paper px-3 py-2");
  if (r.mode === "live") li.classList.add("border-ink/25");
  if (fresh) li.classList.add("cr-in");
  const top = el("div", "flex items-start gap-2");
  top.append(modeLabel(r.mode), el("span", "min-w-0 flex-1 text-sm font-medium leading-snug", lang === "ja" ? r.title_ja : r.title_en));
  const meta = el("div", "mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-ink-soft");
  meta.append(el("span", "font-semibold text-ink", r.agent), el("span", "", r.conference_id));
  if (r.model) meta.append(el("span", "", r.model.replace(/^anthropic\//, "")));
  if (r.ms != null) meta.append(el("span", "tabular-nums", `${fmt.format(r.ms)} ms`));
  if (r.handed_to_human) meta.append(el("span", "text-banana", S.handoff));
  li.append(top, meta);
  return li;
}

function addLive(rows: Row[]) {
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    liveCount++;
    if (!lastTs || r.ts > lastTs) lastTs = r.ts;
    waiting?.remove();
    waiting = null;
    feed.prepend(feedRow(r, true));
  }
  if (rows.length) renderKpis();
}

async function pollLive() {
  try {
    // ts has 1 s resolution, so ask from a second back; seen ids drop the repeats.
    const after = lastTs ? new Date(Date.parse(lastTs) - 1000).toISOString().slice(0, 19) + "+00:00" : "";
    addLive(await apiGet<Row[]>(`/api/ops/live${after ? `?after=${encodeURIComponent(after)}` : ""}`));
  } catch {
    // backend asleep or unreachable: keep showing replay rows, try again next tick
  }
  setTimeout(pollLive, 3000);
}

waiting = el("li", "rounded-lg border border-dashed border-ink/20 px-3 py-2 text-xs text-ink-soft", S.feedWaiting);
feed.append(waiting, ...(data.replay as Row[]).map((r) => feedRow(r, false)));
renderOrg();
renderKpis();
if (!agentsData) loadAgents();
else setTimeout(loadAgents, 30_000);
pollLive();
