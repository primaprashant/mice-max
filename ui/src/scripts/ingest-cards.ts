/** Output preview cards for /ops/run, one per pipeline step. Returns HTML strings. */

export interface Strings { lang: "en" | "ja"; [key: string]: any }
export interface StepResult {
  n: number; mode: "live" | "replay"; agent: string; tool: string; model: string | null; ms: number | null;
  tokens_in: number | null; tokens_out: number | null; confidence: number | null;
  title_en: string; title_ja: string; summary_en: string; summary_ja: string;
  counters: { value: number | string; en: string; ja: string }[]; preview: any;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const pick = (o: any, key: string, S: Strings) => (S.lang === "ja" ? o[`${key}_ja`] || o[`${key}_en`] : o[`${key}_en`] || o[`${key}_ja`]);
const h = (s: string) => `<h4 class="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">${esc(s)}</h4>`;
const pct = (x: number | null | undefined) => (x == null ? "" : `${Math.round(x * 100)}%`);
const chip = (s: string) => `<span class="rounded-full bg-muted px-2 py-0.5 text-xs">${esc(s)}</span>`;
const tag = (S: Strings, mode: string) => mode === "live"
  ? `<span class="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper">${esc(S.live)}</span>`
  : `<span class="rounded border border-ink/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-soft">${esc(S.replay)}</span>`;

function struck(title: string, why: string) {
  return `<li class="flex flex-wrap gap-x-2"><span class="line-through decoration-banana decoration-2 text-ink-soft">${esc(title)}</span><span class="text-xs text-banana">${esc(why)}</span></li>`;
}

const BODY: Record<number, (p: any, S: Strings) => string> = {
  1: (p, S) => {
    const f = p.facts;
    const rows: [string, string][] = [[S.facts.name, S.lang === "ja" ? f.name_ja || f.name_en : f.name_en || f.name_ja],
      [S.facts.dates, `${f.start_date ?? ""} ${f.end_date ? `〜 ${f.end_date}` : ""}`], [S.facts.venue, pick(f, "venue", S)],
      [S.facts.field, f.field], [S.facts.attendees, f.attendees_expected?.toLocaleString()]];
    return `<dl class="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">${rows.filter(([, v]) => v).map(([k, v]) =>
      `<dt class="text-ink-soft">${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${h(S.pages)}<ul class="font-mono text-xs text-ink-soft">${
      p.pages.map((u: string) => `<li class="truncate">${esc(u)}</li>`).join("")}</ul>`;
  },
  2: (p, S) => `${p.source === "stored" ? `<p class="mb-2 text-xs text-ink-soft">${esc(S.stored.replace("{n}", p.on_site))}</p>` : ""}
    <table class="w-full text-left text-xs"><tbody>${p.sessions.map((s: any) => `<tr class="border-t border-ink/5">
      <td class="w-36 py-1 pr-3 font-mono tabular-nums whitespace-nowrap">${esc(s.day.slice(5))} ${esc(s.start_time)}–${esc(s.end_time)}</td>
      <td class="py-1 pr-3">${esc(pick(s, "title", S))}</td><td class="w-24 py-1 text-ink-soft">${esc(s.type)}</td></tr>`).join("")}</tbody></table>`,
  3: (p, S) => `${h(S.mustAttend)}<div class="flex flex-wrap gap-1">${p.must.map(chip).join("")}</div>
`,
  4: (p, S) => `<ul class="flex flex-col gap-1 text-sm">${p.windows.map((w: any) => `<li class="grid grid-cols-[9rem_1fr_auto] gap-3">
      <span class="font-mono text-xs tabular-nums">${esc(w.day.slice(5))} ${esc(w.start_time)}–${esc(w.end_time)}</span>
      <span>${esc(pick(w, "name", S))}</span><span class="font-mono text-xs text-ink-soft">${pct(w.confidence)}</span></li>`).join("")}</ul>
    ${p.dropped.length ? h(S.dropped) + `<ul class="text-sm">${p.dropped.map((w: any) => struck(`${w.day.slice(5)} ${w.start_time}–${w.end_time} ${w.name_en}`, w.reason_en)).join("")}</ul>` : ""}`,
  5: (p, S) => `${h(S.fields)}<div class="flex flex-wrap gap-1">${p.fields.map(chip).join("")}</div>
    ${h(S.roles)}<div class="flex flex-wrap gap-1">${Object.entries(p.roles ?? {}).map(([r, v]) => chip(`${r.replace(/_/g, " ")} ${pct(v as number)}`)).join("")}</div>
    ${h(S.interests)}<div class="flex flex-wrap gap-1">${(p.interests ?? []).map(chip).join("")}</div>`,
  6: (p, S) => {
    const w = p.sample;
    if (!w) return "";
    return `<p class="text-sm font-medium">${esc(pick(w, "name", S))} <span class="font-mono text-xs text-ink-soft">${esc(w.day.slice(5))} ${esc(w.start)}–${esc(w.end)}</span></p>
    <div class="mt-2 grid gap-4 sm:grid-cols-2"><div>${h(`${S.accepted} ${w.fits.length}`)}<ul class="text-sm">${
      w.fits.map((e: any) => `<li>${esc(pick(e, "title", S) || e.id)}</li>`).join("")}</ul></div>
    <div>${h(`${S.rejected} ${w.ruled_out.length}`)}<ul class="text-sm">${w.ruled_out.map((e: any) => struck(pick(e, "title", S) || e.id, pick(e, "why", S))).join("")}</ul></div></div>
    ${h(S.perWindow)}<ul class="grid gap-x-6 text-xs sm:grid-cols-2">${p.per_window.map((r: any) => `<li class="flex justify-between gap-3">
      <span>${esc(pick(r, "name", S))}</span><span class="font-mono tabular-nums text-ink-soft">${r.fits} / ${r.fits + r.ruled_out}</span></li>`).join("")}</ul>`;
  },
  7: (p, S) => `<div class="grid gap-4 sm:grid-cols-2"><div>${h(S.kept)}<ul class="flex flex-col gap-1 text-sm">${p.kept.map((i: any) =>
      `<li>${esc(pick(i, "title", S))}</li>`).join("")}</ul></div>
    <div>${h(S.rejected)}<ul class="flex flex-col gap-1 text-sm">${p.rejected.map((i: any) => struck(pick(i, "title", S), pick(i, "reject", S))).join("")}</ul></div></div>`,
  8: (p, S) => `<ul class="flex flex-col gap-3 text-sm">${p.top.map((t: any) => `<li><p class="flex flex-wrap items-center gap-2 font-medium">${esc(pick(t, "name", S))}
      <span class="font-mono text-xs text-ink-soft">${esc(S.confidence)} ${pct(t.confidence)}</span>
      ${t.needs_approval ? `<span class="rounded bg-banana-soft px-1.5 py-0.5 text-[11px] text-banana">${esc(S.approve)}</span>` : ""}</p>
      <ol class="ml-5 list-decimal text-ink-soft">${t.picks.map((e: any) => `<li>${esc(pick(e, "title", S) || e.id)}</li>`).join("")}</ol></li>`).join("")}</ul>`,
  9: (p, S) => {
    const col = (lang: "ja" | "en") => { const m = p[`email_${lang}`] ?? {}; return `<div lang="${lang}">
      ${h(`${S.intro9} ${lang.toUpperCase()}`)}<p class="text-sm">${esc(p[`intro_${lang}`])}</p>
      ${h(`${S.email} ${lang.toUpperCase()}`)}<div class="rounded-lg bg-muted p-3 text-sm"><p class="font-medium">${esc(m.subject)}</p>
      <p class="mt-2 whitespace-pre-line text-ink-soft">${esc(m.body)}</p></div></div>`; };
    return `<div class="grid gap-6 md:grid-cols-2">${col("ja")}${col("en")}</div>`;
  },
};

export function renderCard(r: StepResult, S: Strings): string {
  const stats = [r.agent, r.model ? r.model.split("/").pop() : r.tool, r.ms != null ? `${r.ms.toLocaleString()} ms` : "",
    r.tokens_out != null ? `${(r.tokens_in ?? 0).toLocaleString()} in ${r.tokens_out.toLocaleString()} out` : "",
    r.confidence != null ? `${S.confidence} ${pct(r.confidence)}` : ""].filter(Boolean);
  return `<article class="ingest-card rounded-xl border border-ink/10 bg-paper p-4">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="font-mono text-xs text-ink-soft">${String(r.n).padStart(2, "0")}</span>
      <h3 class="text-sm font-semibold">${esc(pick(r, "title", S))}</h3>${tag(S, r.mode)}
      <span class="ml-auto flex flex-wrap gap-3 font-mono text-[11px] text-ink-soft">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</span>
    </header>
    <p class="mt-2 text-sm">${esc(pick(r, "summary", S))}</p>
    ${r.mode === "replay" ? `<p class="mt-1 text-xs text-ink-soft">${esc(S.replayNote)}</p>` : ""}
    <div class="mt-2">${BODY[r.n]?.(r.preview ?? {}, S) ?? ""}</div></article>`;
}
