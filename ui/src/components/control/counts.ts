/** Server-side counts for the /ops page, read from the SQLite master copy.
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
    events: count("SELECT COUNT(*) n FROM events"),
    photos: count("SELECT (SELECT COUNT(*) FROM plan_photos) + (SELECT COUNT(*) FROM experience_photos) n"),
    copy: count("SELECT (SELECT COUNT(*) FROM plan_copy) + (SELECT COUNT(*) FROM experience_copy) n"),
  };
}
