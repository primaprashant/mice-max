/** Server-side shaping for the Ops view: groups agent_steps into phases and
 * pulls the special rows (call, Q&A, disruption) out of their output JSON. */
import type { AgentStep, OpsPhase } from "./types";

export const PHASES: OpsPhase[] = ["setup", "before", "during", "after"];

export interface CallLine {
  speaker: "agent" | "staff";
  ja: string;
  en: string;
}

export interface CallDetail {
  lines: CallLine[];
  audio: { path: string } | null;
  result_ja: string;
  result_en: string;
}

export interface QaItem {
  who: "attendee" | "organizer";
  q_ja: string;
  q_en: string;
  a_ja: string;
  a_en: string;
}

export interface DisruptionDetail {
  alert_ja: string;
  alert_en: string;
  messages: { ja: string; en: string }[];
  picks: { from: string; to: string }[];
}

/** The booking-call row for a conference, with its transcript parsed. */
export function callDetail(steps: AgentStep[], conferenceId: string): { step: AgentStep; call: CallDetail } | undefined {
  const step = steps.find((s) => s.id === `${conferenceId}-call-01`);
  if (!step || !step.output || typeof step.output !== "object") return undefined;
  const o = step.output as Record<string, any>;
  return {
    step,
    call: {
      lines: o.lines ?? [],
      audio: o.audio ? { path: o.audio.path } : null,
      result_ja: o.result_ja ?? "",
      result_en: o.result_en ?? "",
    },
  };
}

/** Q&A rows in ts order, attendee and organizer together. */
export function qaItems(steps: AgentStep[], conferenceId: string): { step: AgentStep; item: QaItem }[] {
  return steps
    .filter((s) => s.id.startsWith(`${conferenceId}-qa-`))
    .filter((s) => s.output && typeof s.output === "object")
    .map((step) => ({ step, item: step.output as unknown as QaItem }));
}

/** The disruption rows: alert, messages, picks. One row per agent action. */
export function disruptionDetail(steps: AgentStep[], conferenceId: string): DisruptionDetail | undefined {
  const rows = steps.filter((s) => s.id.startsWith(`${conferenceId}-disruption-`));
  if (rows.length === 0) return undefined;
  const alertRow = rows.find((s) => {
    const o = s.output as Record<string, any> | null;
    return o?.alert;
  });
  const messageRow = rows.find((s) => s.agent === "mailer");
  const pickRow = rows.find((s) => s.agent === "replanner" && (s.output as any)?.picks);
  if (!alertRow) return undefined;
  const alert = (alertRow.output as Record<string, any>).alert;
  const messages = ((messageRow?.output as Record<string, any>)?.messages ?? []) as Record<string, string>[];
  const picks = ((pickRow?.output as Record<string, any>)?.picks ?? []) as Record<string, string>[];
  return {
    alert_ja: alert.ja ?? "",
    alert_en: alert.en ?? "",
    messages: messages.map((m) => ({ ja: m.ja ?? "", en: m.en ?? "" })),
    picks: picks.map((p) => ({ from: p.from_experience_id ?? "", to: p.to_experience_id ?? "" })),
  };
}

const TRUNCATE_ARRAY_LIMIT = 20;
const TRUNCATE_STRING_LIMIT = 500;
const TRUNCATE_OUTPUT_LIMIT = 8000;

function truncateValue(value: unknown, moreLabel: (n: number) => string): unknown {
  if (typeof value === "string") {
    return value.length > TRUNCATE_STRING_LIMIT ? `${value.slice(0, TRUNCATE_STRING_LIMIT)}…` : value;
  }
  if (Array.isArray(value)) {
    if (value.length <= TRUNCATE_ARRAY_LIMIT) return value.map((v) => truncateValue(v, moreLabel));
    const items = value.slice(0, TRUNCATE_ARRAY_LIMIT).map((v) => truncateValue(v, moreLabel));
    items.push({ "...truncated": moreLabel(value.length - TRUNCATE_ARRAY_LIMIT) });
    return items;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (Array.isArray(v) && v.length > TRUNCATE_ARRAY_LIMIT) {
        out[key] = v.slice(0, TRUNCATE_ARRAY_LIMIT).map((item) => truncateValue(item, moreLabel));
        out["...truncated"] = moreLabel(v.length - TRUNCATE_ARRAY_LIMIT);
      } else {
        out[key] = truncateValue(v, moreLabel);
      }
    }
    return out;
  }
  return value;
}

/** Cap a step's output JSON for the embedded block: arrays over
 * TRUNCATE_ARRAY_LIMIT keep the first items plus a "...truncated" marker,
 * strings over TRUNCATE_STRING_LIMIT are cut with an ellipsis. The JSON is
 * illustrative demo data; full fidelity does not matter. */
export function truncateOutput(value: unknown, moreLabel: (n: number) => string = (n) => `${n} more items`): unknown {
  if (value == null || typeof value !== "object") return value;
  if (JSON.stringify(value).length <= TRUNCATE_OUTPUT_LIMIT) return value;
  return truncateValue(value, moreLabel);
}

/** Experience ids mentioned in disruption picks, for title lookup. */
export function disruptionExperienceIds(d: DisruptionDetail | undefined): string[] {
  if (!d) return [];
  return [...new Set(d.picks.flatMap((p) => [p.from, p.to]).filter(Boolean))];
}
