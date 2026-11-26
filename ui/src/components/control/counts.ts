/** Server-side counts for the control room, read from the SQLite master copy.
 * (data/index.ts keeps its connection private, so this opens its own.) */
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function dbPath(): string {
  if (process.env.MICEMAX_DB) return process.env.MICEMAX_DB;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, "data/micemax.db");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return resolve(dir, "data/micemax.db");
}

let db: DatabaseSync | null = null;
const get = () => (db ??= new DatabaseSync(dbPath(), { readOnly: true }));
const count = (sql: string) => Number((get().prepare(sql).get() as any).n);

export function builtCounts() {
  return {
    conferences: count("SELECT COUNT(*) n FROM conferences"),
    sessions: count("SELECT COUNT(*) n FROM sessions"),
    plans: count("SELECT COUNT(*) n FROM plans"),
    experiences: count("SELECT COUNT(*) n FROM experiences"),
    photos: count("SELECT (SELECT COUNT(*) FROM plan_photos) + (SELECT COUNT(*) FROM experience_photos) n"),
    copy: count("SELECT (SELECT COUNT(*) FROM plan_copy) + (SELECT COUNT(*) FROM experience_copy) n"),
  };
}

export interface FeedRow {
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
  simulated: number;
}

/** Newest replay rows across conferences, for the feed when no live rows exist yet. */
export function replayFeed(limit = 30): FeedRow[] {
  return get()
    .prepare(
      `SELECT id, conference_id, ts, agent, title_en, title_ja, model, ms, mode, handed_to_human, simulated
       FROM agent_steps ORDER BY ts DESC LIMIT ?`
    )
    .all(limit) as unknown as FeedRow[];
}

export function replayTotals() {
  return {
    steps: count("SELECT COUNT(*) n FROM agent_steps"),
    handoffs: count("SELECT COUNT(*) n FROM agent_steps WHERE handed_to_human = 1"),
  };
}
