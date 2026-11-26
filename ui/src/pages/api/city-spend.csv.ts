import type { APIRoute } from "astro";
import { committedSpendDetailed } from "../../data";

export const prerender = false;

const CSV_HEADER = "month,kind,area_en,area_ja,conference,count,jpy_log";

/** Full breakdown of committed spend: one row per conference-month-kind-area,
 * raw simulated-log amounts. Same data function the city view's chart and
 * splits read, so the numbers cannot disagree. */
export const GET: APIRoute = async () => {
  const rows = committedSpendDetailed();
  const lines = [CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [r.month, r.kind, r.area, r.area_ja, r.conference, r.count, r.jpy].map(csvField).join(",")
    );
  }
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="micemax-city-spend.csv"',
    },
  });
};

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
