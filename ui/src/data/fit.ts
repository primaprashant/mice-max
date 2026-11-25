/** Which experiences fit a free-time window. A TypeScript port of the same
 * rule the simulator uses (data/scripts/simulate.py: fits), so the UI agrees
 * with the graph's FITS edges. Whole-window rule, not per-person. */
import type { Conference, Experience, Window } from "./types";
import { minutesBetween } from "./city";

const DEFAULT_MIN: Record<string, number> = { short: 60, evening: 120, specialist: 90 };
const DEFAULT_TRAVEL = 40;

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Conference fields in the same snake_case form the experience `fields` JSON
 * uses: field and field_detail with spaces replaced. */
export function conferenceFields(conf: Conference): string[] {
  return [conf.field, conf.field_detail]
    .filter(Boolean)
    .map((f) => f!.replace(/ /g, "_"));
}

export function fitsWindow(
  e: Experience,
  w: Window,
  travel: number | undefined,
  conf: Conference
): boolean {
  const kinds = KINDS_BY_WINDOW[w.kind] ?? [];
  if (!kinds.includes(e.kind)) return false;
  if (e.kind === "specialist" && e.fields.length > 0) {
    const confFields = conferenceFields(conf);
    if (!e.fields.some((f) => confFields.includes(f))) return false;
  }
  if (e.kind === "extra_night") {
    // Any time from the window start; must leave by start_until (leave_by).
    if (!e.start_until) return true;
    return hhmmToMin(w.start_time) <= hhmmToMin(e.start_until);
  }
  const need = e.duration_min ?? DEFAULT_MIN[e.kind] ?? 60;
  const t = travel ?? DEFAULT_TRAVEL;
  const free = minutesBetween(w.start_time, w.end_time);
  if (need + 2 * t > free) return false;
  let begin = hhmmToMin(w.start_time) + t;
  if (e.start_from) begin = Math.max(begin, hhmmToMin(e.start_from));
  if (e.start_until && begin > hhmmToMin(e.start_until)) return false;
  return begin + need + t <= hhmmToMin(w.end_time);
}

/** Which experience kinds a window kind accepts. Mirrors the windows.plan_kinds
 * column, which the data import filled per window. */
const KINDS_BY_WINDOW: Record<string, string[]> = {
  early_morning: ["short"],
  lunch: ["short", "specialist"],
  evening: ["evening"],
  free_afternoon: ["short", "evening", "specialist"],
  during_program: ["short", "specialist"],
  after_close: ["short", "evening", "specialist"],
  extra_night: ["extra_night"],
};
