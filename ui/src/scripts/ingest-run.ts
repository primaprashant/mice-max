/** /ops/run: start a live ingest run and call steps 1-9 in turn, animating the track as each finishes. */
import { apiGet, apiPost } from "./api";
import { renderCard, esc, type StepResult, type Strings } from "./ingest-cards";
import { press } from "./sfx";

interface Tested { id: string; name_en: string; name_ja: string | null; url: string }
interface Start { run_id: string }

/** Counters shown in the strip: [step, index into that step's counters]. */
const STRIP: [number, number][] = [[2, 0], [3, 1], [4, 0], [6, 1], [6, 2], [7, 1]];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id: string) => document.getElementById(id)!;

export function initIngest() {
  const S = JSON.parse($("ingest-strings").textContent!) as Strings;
  const form = $("ingest-form") as HTMLFormElement;
  const input = $("ingest-url") as HTMLInputElement;
  apiGet<Tested[]>("/api/ingest/tested").then((list) => {
    $("ingest-tested").innerHTML = list.map((c) =>
      `<button type="button" data-url="${esc(c.url)}" class="min-h-11 rounded-full border border-ink/15 px-3 text-xs font-medium hover:border-theme">${esc(c.id.toUpperCase().replace("ICCDU24", "ICCDU2027"))}</button>`).join("");
    $("ingest-tested").querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      b.addEventListener("click", () => { input.value = b.dataset.url!; form.requestSubmit(); }));
  }).catch(() => {});
  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value.trim(), S); });
  if (input.value) run(input.value.trim(), S);
}

let running = false;

async function run(url: string, S: Strings) {
  if (running || !url) return;
  running = true;
  ($("ingest-go") as HTMLButtonElement).disabled = true;
  history.replaceState(null, "", `?url=${encodeURIComponent(url)}`);
  reset();
  const t0 = performance.now();
  let tokens = 0;
  const elapsed = tile(S.elapsed);
  const tok = tile(S.tokens);
  const clock = setInterval(() => (elapsed.textContent = `${((performance.now() - t0) / 1000).toFixed(1)} s`), 100);
  try {
    const { run_id } = await apiPost<Start>("/api/ingest/start", { url });
    for (let n = 1; n <= 9; n++) {
      setNode(n, "active");
      if (n < 9) setLink(n, "on");
      let res: StepResult;
      try {
        res = await apiPost<StepResult>(`/api/ingest/${run_id}/step/${n}`, {});
      } catch {
        press("treadmill-sharp");
        setNode(n, "failed");
        if (n < 9) setLink(n, "");
        $("ingest-status").textContent = S.failed.replace("{n}", String(n));
        return;
      }
      setNode(n, res.mode === "replay" ? "replay" : "done", res, S);
      if (n < 9) setLink(n, "done");
      tokens += (res.tokens_in ?? 0) + (res.tokens_out ?? 0);
      count(tok, tokens);
      STRIP.filter(([s]) => s === n).forEach(([, i]) => {
        const c = res.counters[i];
        if (c) count(tile(S.lang === "ja" ? c.ja : c.en), Number(c.value));
      });
      $("ingest-cards").insertAdjacentHTML("beforeend", renderCard(res, S));
    }
    $("ingest-status").textContent = S.done.replace("{s}", ((performance.now() - t0) / 1000).toFixed(1));
    press("ps4-double");
  } finally {
    clearInterval(clock);
    running = false;
    ($("ingest-go") as HTMLButtonElement).disabled = false;
  }
}

function reset() {
  $("ingest-stage").classList.remove("hidden");
  $("ingest-counters").innerHTML = "";
  $("ingest-cards").innerHTML = "";
  $("ingest-status").textContent = "";
  document.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => {
    el.dataset.state = "idle";
    el.querySelector("[data-meta]")!.innerHTML = "";
  });
  document.querySelectorAll<HTMLElement>("[data-link]").forEach((el) => (el.dataset.flow = ""));
}

function setNode(n: number, state: string, res?: StepResult, S?: Strings) {
  const el = document.querySelector<HTMLElement>(`[data-node="${n}"]`)!;
  el.dataset.state = state;
  if (!res || !S) return;
  const model = res.model ? res.model.split("/").pop() : res.tool;
  const tk = res.tokens_out != null ? `${res.tokens_in ?? 0}→${res.tokens_out} tok` : "";
  el.querySelector("[data-meta]")!.innerHTML = [res.agent, model, res.ms != null ? `${(res.ms / 1000).toFixed(1)} s` : "", tk,
    res.mode === "replay" ? S.replay : ""].filter(Boolean).map((x) => `<span class="block">${esc(String(x))}</span>`).join("");
}

function setLink(n: number, flow: string) {
  const el = document.querySelector<HTMLElement>(`[data-link="${n}"]`);
  if (el) el.dataset.flow = flow;
}

function tile(label: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "ingest-card rounded-lg border border-ink/10 px-3 py-2";
  box.innerHTML = `<span class="block font-mono text-xl font-semibold tabular-nums">0</span><span class="block text-[11px] text-ink-soft">${esc(label)}</span>`;
  $("ingest-counters").append(box);
  return box.firstElementChild as HTMLElement;
}

/** Tick a number up to its value (or set it at once with reduced motion). */
function count(el: HTMLElement, to: number) {
  if (!Number.isFinite(to)) return;
  const from = Number(el.textContent?.replace(/\D/g, "")) || 0;
  if (reduced) return void (el.textContent = to.toLocaleString());
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 700);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - p) ** 3)).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
