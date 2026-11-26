/** City view: area donut. Slices and legend are server-rendered; this client
 * script drives the center readout from hover only — the chart is not a
 * control, so slices take no click, focus, or button role. Hovering a slice
 * or its legend row shows that area (name, spend, plan count); leaving
 * returns the center to the total. The table view toggle keeps the exact
 * figures reachable without the chart. All names are inserted with
 * textContent, never innerHTML. */
const el = document.querySelector<HTMLElement>("city-area-donut");
const lang = (document.documentElement.lang === "ja" ? "ja" : "en") as "en" | "ja";

const LABELS: Record<"en" | "ja", { total: string; plans: string }> = {
  en: { total: "Total committed spend", plans: "plans" },
  ja: { total: "合計", plans: "プラン" },
};

function fmt(n: number): string {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

if (el) {
  const labelEl = el.querySelector("#city-donut-label")!;
  const valueEl = el.querySelector("#city-donut-value")!;
  const subEl = el.querySelector("#city-donut-sub")!;
  const tableEl = el.querySelector<HTMLElement>("[slot=table]")!;
  const donutEl = el.querySelector<HTMLElement>("[slot=donut]")!;
  const totalJpy = Number(valueEl.textContent?.replace(/[^\d]/g, "") ?? 0);

  function showTotal(): void {
    labelEl.textContent = LABELS[lang].total;
    valueEl.textContent = fmt(totalJpy);
    subEl.textContent = "";
  }

  function hover(key: string | null): void {
    const slice = key
      ? [...el!.querySelectorAll<SVGGElement>("g[data-area]")].find((g) => g.dataset.area === key)
      : undefined;
    const legendRow = key
      ? el!.querySelector<HTMLElement>(`[data-legend][data-area="${CSS.escape(key)}"]`)
      : undefined;
    // No dimming: the hover feedback is the center readout and the legend
    // wash only; slices keep their full color.
    for (const row of el!.querySelectorAll<HTMLElement>("[data-legend]")) {
      row.classList.toggle("bg-ink/5", row === legendRow);
    }
    if (!slice) {
      showTotal();
      return;
    }
    labelEl.textContent = slice.dataset.name ?? "";
    valueEl.textContent = fmt(Number(slice.dataset.jpy ?? 0));
    subEl.textContent = `${Number(slice.dataset.count ?? 0).toLocaleString("ja-JP")} ${LABELS[lang].plans}`;
  }

  for (const g of el.querySelectorAll<SVGGElement>("g[data-area]")) {
    g.addEventListener("pointerenter", () => hover(g.dataset.area ?? null));
  }
  for (const row of el.querySelectorAll<HTMLElement>("[data-legend]")) {
    row.addEventListener("pointerenter", () => hover(row.dataset.area ?? null));
  }
  el.addEventListener("pointerleave", () => hover(null));

  // Table view toggle, same pattern as the monthly chart.
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className =
    "inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5";
  toggle.textContent = lang === "ja" ? "表で見る" : "View as table";
  toggle.addEventListener("click", () => {
    const showingTable = !tableEl.hidden;
    tableEl.hidden = !showingTable;
    donutEl.hidden = showingTable;
    toggle.textContent = showingTable
      ? lang === "ja" ? "グラフに戻る" : "Back to chart"
      : lang === "ja" ? "表で見る" : "View as table";
  });
  donutEl.parentElement!.appendChild(toggle);

  showTotal();
}
