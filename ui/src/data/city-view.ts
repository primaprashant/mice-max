/** City view aggregates, read from the events log and city_estimates. */
import type { CityEstimate } from "./types";

export interface SpendSplit {
  kind: string;
  count: number;
  jpy: number;
}

export interface AreaSplit {
  area: string;
  area_ja: string;
  count: number;
  jpy: number;
}

export interface ConferenceReach {
  id: string;
  name_en: string;
  attendees: number;
  reached: number;
}

export function spendByKind(
  rows: { kind: string; jpy: number | null }[]
): SpendSplit[] {
  const map = new Map<string, SpendSplit>();
  for (const r of rows) {
    const cur = map.get(r.kind) ?? { kind: r.kind, count: 0, jpy: 0 };
    cur.count += 1;
    cur.jpy += r.jpy ?? 0;
    map.set(r.kind, cur);
  }
  return [...map.values()].sort((a, b) => b.jpy - a.jpy);
}

export function spendByArea(
  rows: { area: string; area_ja: string; jpy: number | null }[]
): AreaSplit[] {
  const map = new Map<string, AreaSplit>();
  for (const r of rows) {
    const cur = map.get(r.area) ?? { area: r.area, area_ja: r.area_ja, count: 0, jpy: 0 };
    cur.count += 1;
    cur.jpy += r.jpy ?? 0;
    map.set(r.area, cur);
  }
  return [...map.values()].sort((a, b) => b.jpy - a.jpy);
}

/** Totals the city view shows: simulated bookings and their price sum, scaled
 * by simulation_runs.scale to the conference's real size. */
export function scaleTotals(
  commits: { conferenceId: string; jpy: number | null }[],
  scales: Map<string, number>
): { count: number; jpy: number } {
  let count = 0;
  let jpy = 0;
  for (const c of commits) {
    const scale = scales.get(c.conferenceId) ?? 1;
    count += scale;
    jpy += (c.jpy ?? 0) * scale;
  }
  return { count: Math.round(count), jpy: Math.round(jpy) };
}

export function totalsOf(estimates: CityEstimate[]) {
  return {
    early: estimates.reduce((s, e) => s + e.early_jpy, 0),
    middle: estimates.reduce((s, e) => s + e.middle_jpy, 0),
    strong: estimates.reduce((s, e) => s + e.strong_jpy, 0),
  };
}
