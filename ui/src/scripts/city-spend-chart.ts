/** City view: monthly spend chart. Bars are server-rendered SVG; this client
 * script adds the hover tooltip, the table-view toggle, and the month
 * breakdown panel below the chart (updated on bar click, first month
 * selected on load). The breakdown data is server-rendered JSON. All names
 * are inserted with textContent, never innerHTML. */
import { monthLabel } from "../data/city";

const el = document.querySelector<HTMLElement>("city-spend-chart");
const tooltip = document.getElementById("city-chart-tooltip");
const lang = (document.documentElement.lang === "ja" ? "ja" : "en") as "en" | "ja";

const TABLE_LABEL: Record<"en" | "ja", [string, string]> = {
  en: ["View as table", "Back to chart"],
  ja: ["表で見る", "グラフに戻る"],
};

const KIND_LABEL: Record<string, Record<"en" | "ja", string>> = {
  short: { en: "Short activity", ja: "ショートアクティビティ" },
  evening: { en: "Evening", ja: "夜のプラン" },
  extra_night: { en: "Extra night", ja: "一泊追加" },
  specialist: { en: "Specialist visit", ja: "専門訪問" },
};

function fmt(n: number): string {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

interface Detail {
  kind: { kind: string; count: number; jpy: number }[];
  conference: { name: string; jpy: number }[];
}

const monthlyDetail: Record<string, Detail> = JSON.parse(
  document.querySelector("[data-monthly-detail]")?.textContent ?? "{}"
);

if (el && tooltip) {
  const chartEl = el.querySelector<HTMLElement>("[slot=chart]")!;
  const tableEl = el.querySelector<HTMLElement>("[slot=table]")!;
  const toggle = document.getElementById("city-chart-toggle") as HTMLButtonElement | null;
  let showingTable = false;

  toggle?.addEventListener("click", () => {
    showingTable = !showingTable;
    tableEl.hidden = !showingTable;
    chartEl.hidden = showingTable;
    toggle.textContent = TABLE_LABEL[lang][showingTable ? 1 : 0];
  });

  /** One panel row: name on the left, amount on the right. */
  function panelRow(name: string, jpy: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex items-baseline justify-between gap-4";
    const nameSpan = document.createElement("span");
    nameSpan.className = "text-ink-soft";
    nameSpan.textContent = name;
    const amount = document.createElement("span");
    amount.className = "font-mono font-medium tabular-nums text-ink";
    amount.textContent = fmt(jpy);
    row.appendChild(nameSpan);
    row.appendChild(amount);
    return row;
  }

  /** Fill the breakdown panel below the chart for one month. */
  function fillDetail(month: string, total: number, count: number): void {
    const title = document.getElementById("city-month-detail-title")!;
    const totalEl = document.getElementById("city-month-detail-total")!;
    const countEl = document.getElementById("city-month-detail-count")!;
    const kindsEl = document.getElementById("city-detail-kinds")!;
    const confsEl = document.getElementById("city-detail-confs")!;
    title.textContent = monthLabel(month, lang);
    totalEl.textContent = fmt(total);
    countEl.textContent = `${count.toLocaleString("ja-JP")} ${lang === "ja" ? "プラン" : "plans"}`;
    kindsEl.replaceChildren();
    confsEl.replaceChildren();
    const detail = monthlyDetail[month];
    if (!detail) return;
    for (const k of detail.kind) {
      if (k.jpy === 0) continue; // a type with bookings but no price adds noise
      kindsEl.appendChild(panelRow(KIND_LABEL[k.kind]?.[lang] ?? k.kind, k.jpy));
    }
    for (const c of detail.conference) {
      confsEl.appendChild(panelRow(c.name, c.jpy));
    }
  }

  const bars = [...el.querySelectorAll<SVGGElement>(".bar-group")];

  for (const bar of bars) {
    bar.setAttribute("tabindex", "0");
    const m = bar.dataset.month ?? "";
    bar.setAttribute("role", "button");
    bar.setAttribute("aria-label", `${monthLabel(m, lang)}, ${fmt(Number(bar.dataset.jpy ?? 0))}`);
    const show = () => {
      const barRect = bar.querySelector("path")!.getBoundingClientRect();
      const svgRect = chartEl.querySelector("svg")!.getBoundingClientRect();
      tooltip.querySelector("#city-chart-tooltip-value")!.textContent = fmt(Number(bar.dataset.jpy ?? 0));
      tooltip.querySelector("#city-chart-tooltip-detail")!.textContent =
        `${monthLabel(m, lang)}: ${Number(bar.dataset.count ?? 0).toLocaleString("ja-JP")}`;
      tooltip.style.transform = `translate(${barRect.left - svgRect.left + barRect.width / 2}px, ${barRect.top - svgRect.top - tooltip.offsetHeight - 6}px)`;
      tooltip.classList.remove("hidden");
    };
    const hide = () => tooltip.classList.add("hidden");
    bar.addEventListener("pointerenter", show);
    bar.addEventListener("pointerleave", hide);
    bar.addEventListener("focus", () => {
      const ring = bar.querySelector<SVGPathElement>(".bar-ring")!;
      ring.style.opacity = "1";
      show();
    });
    bar.addEventListener("blur", () => {
      (bar.querySelector(".bar-ring") as SVGPathElement).style.opacity = "";
      hide();
    });
    bar.addEventListener("click", () => {
      fillDetail(m, Number(bar.dataset.jpy ?? 0), Number(bar.dataset.count ?? 0));
    });
    bar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fillDetail(m, Number(bar.dataset.jpy ?? 0), Number(bar.dataset.count ?? 0));
      }
    });
  }

  // First month selected by default.
  if (bars[0]) {
    fillDetail(
      bars[0].dataset.month ?? "",
      Number(bars[0].dataset.jpy ?? 0),
      Number(bars[0].dataset.count ?? 0)
    );
  }
}
