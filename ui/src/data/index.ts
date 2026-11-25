/** The one data module. Screens never query the database directly.
 * Reads Neon when DATABASE_URL is set, else the committed SQLite master copy
 * (../data/micemax.db), so every screen works offline. */
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Conference,
  Session,
  Window,
  Experience,
  ExperienceCopy,
  ExperiencePhoto,
  ExperienceStop,
  ExperienceKind,
  Travel,
  Tag,
  Headline,
  Attendee,
  CityEstimate,
  Season,
  CityEvent,
} from "./types";

const DEMO_CONFERENCE_IDS = ["jadm32", "icep2027"] as const;

/** Resolved from the repo layout (ui → mice-max/data). The built bundle lives
 * deeper (ui/dist/.../chunks), so the depth differs between dev and build; walk
 * up with a real path resolver until the file exists. Override with MICEMAX_DB. */
const DB_FILENAME = "data/micemax.db";
const DEFAULT_DB_PATH = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, DB_FILENAME);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return resolve(dir, DB_FILENAME);
})();

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  if (process.env.DATABASE_URL) {
    throw new Error("Neon connection not wired yet: set up the Postgres client swap");
  }
  db = new DatabaseSync(process.env.MICEMAX_DB ?? DEFAULT_DB_PATH, { readOnly: true });
  return db;
}

// --- row mapping -----------------------------------------------------------

function mapConference(r: any): Conference {
  return {
    id: r.id,
    name_ja: r.name_ja,
    name_en: r.name_en,
    start_date: r.start_date,
    end_date: r.end_date,
    end_weekday: r.end_weekday,
    field: r.field,
    field_detail: r.field_detail,
    scope: r.scope,
    attendees: r.attendees,
    overseas_attendees: r.overseas_attendees,
    main_venue_place_id: r.main_venue_place_id,
  };
}

function mapSession(r: any): Session {
  return {
    id: r.id,
    conference_id: r.conference_id,
    basis: r.basis,
    day: r.day,
    start_time: r.start_time,
    end_time: r.end_time,
    title_ja: r.title_ja,
    title_en: r.title_en,
    type: r.type,
    track: r.track,
    room: r.room,
    fee_jpy: r.fee_jpy,
  };
}

function mapWindow(r: any): Window {
  return {
    id: r.id,
    conference_id: r.conference_id,
    day: r.day,
    start_time: r.start_time,
    end_time: r.end_time,
    kind: r.kind,
    name_ja: r.name_ja,
    name_en: r.name_en,
    overlaps_program: r.overlaps_program === 1,
    overlap_note: r.overlap_note,
  };
}

function mapExperience(r: any): Experience {
  return {
    id: r.id,
    kind: r.kind,
    is_combo: r.is_combo === 1,
    stop_count: r.stop_count,
    area_id: r.area_id,
    duration_min: r.duration_min,
    start_from: r.start_from,
    start_until: r.start_until,
    price_jpy: r.price_jpy,
    price_max_jpy: r.price_max_jpy,
    price_note: r.price_note,
    party_min: r.party_min,
    party_max: r.party_max,
    english_ok: r.english_ok === 1,
    needs_agreement: r.needs_agreement === 1,
    fields: r.fields ? JSON.parse(r.fields) : [],
    months: r.months ? JSON.parse(r.months) : null,
    days_closed: r.days_closed,
  };
}

function mapCopy(r: any): ExperienceCopy {
  return {
    card_title: r.card_title,
    hook: r.hook,
    description: r.description,
    included: r.included,
    good_to_know: r.good_to_know,
  };
}

function mapPhoto(r: any): ExperiencePhoto {
  // The database stores data/images/<plan_id>/<n>.jpg; served from public/.
  return {
    n: r.n,
    path: "/" + r.path.replace(/^data\//, ""),
    width: r.width,
    height: r.height,
    dominant_color: r.dominant_color,
    alt_ja: r.alt_ja,
    alt_en: r.alt_en,
    is_hero: r.is_hero === 1,
  };
}

function mapAttendee(r: any): Attendee {
  return {
    id: r.id,
    conference_id: r.conference_id,
    name_ja: r.name_ja,
    name_en: r.name_en,
    role: r.role,
    home_prefecture: r.home_prefecture,
    home_country: r.home_country,
    language: r.language,
    party: r.party,
    interests: r.interests ? JSON.parse(r.interests) : [],
    reached: r.reached === 1,
  };
}

// --- queries ---------------------------------------------------------------

export function demoConferenceIds(): string[] {
  return [...DEMO_CONFERENCE_IDS];
}

export function conferences(): Conference[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, v.place_id AS main_venue_place_id
       FROM conferences c
       LEFT JOIN conference_venues v ON v.conference_id = c.id AND v.is_main = 1
       WHERE c.is_demo = 1`
    )
    .all();
  return rows.map(mapConference);
}

export function conferenceById(id: string): Conference | undefined {
  const row = getDb()
    .prepare(
      `SELECT c.*, v.place_id AS main_venue_place_id
       FROM conferences c
       LEFT JOIN conference_venues v ON v.conference_id = c.id AND v.is_main = 1
       WHERE c.id = ?`
    )
    .get(id);
  return row ? mapConference(row) : undefined;
}

export function sessionsForConference(conferenceId: string): Session[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sessions WHERE conference_id = ? ORDER BY day, start_time`)
    .all(conferenceId);
  return rows.map(mapSession);
}

export function windowsForConference(conferenceId: string): Window[] {
  const rows = getDb()
    .prepare(`SELECT * FROM windows WHERE conference_id = ? ORDER BY day, start_time`)
    .all(conferenceId);
  return rows.map(mapWindow);
}

export function windowById(id: string): Window | undefined {
  const row = getDb().prepare(`SELECT * FROM windows WHERE id = ?`).get(id);
  return row ? mapWindow(row) : undefined;
}

/** How many simulated attendees were shown each experience in a window, and
 * how many joined. Drives suggestion order: most shown first (what the
 * simulation's ranking produced), headlines pinned on top by the caller. */
export function windowStats(conferenceId: string): Map<string, { shown: number; joined: number }> {
  const rows = getDb()
    .prepare(
      `SELECT experience_id,
              SUM(CASE WHEN event_type = 'plan_shown' THEN 1 ELSE 0 END) AS shown,
              SUM(CASE WHEN event_type = 'plan_joined' THEN 1 ELSE 0 END) AS joined
       FROM events
       WHERE conference_id = ? AND window_id IS NOT NULL AND experience_id IS NOT NULL
       GROUP BY experience_id`
    )
    .all(conferenceId);
  const map = new Map<string, { shown: number; joined: number }>();
  for (const r of rows as any[]) {
    map.set(r.experience_id, { shown: Number(r.shown), joined: Number(r.joined) });
  }
  return map;
}

/** Simulated join count per experience across the whole conference
 * ("attendees like you picked" and popularity lines). */
export function joinedCounts(conferenceId: string): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT experience_id, COUNT(*) AS c FROM events
       WHERE conference_id = ? AND event_type = 'plan_joined'
       GROUP BY experience_id`
    )
    .all(conferenceId);
  const map = new Map<string, number>();
  for (const r of rows as any[]) map.set(r.experience_id, Number(r.c));
  return map;
}

export function experiencesForConference(conferenceId: string): Experience[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT e.* FROM experiences e
       JOIN events ev ON ev.experience_id = e.id
       WHERE ev.conference_id = ?`
    )
    .all(conferenceId);
  return rows.map(mapExperience);
}

export function experienceById(id: string): Experience | undefined {
  const row = getDb().prepare(`SELECT * FROM experiences WHERE id = ?`).get(id);
  return row ? mapExperience(row) : undefined;
}

export function experienceCopy(id: string, lang: "ja" | "en"): ExperienceCopy | undefined {
  const row = getDb()
    .prepare(`SELECT * FROM experience_copy WHERE experience_id = ? AND lang = ?`)
    .get(id, lang);
  return row ? mapCopy(row) : undefined;
}

export function experiencePhotos(id: string): ExperiencePhoto[] {
  const rows = getDb()
    .prepare(`SELECT * FROM experience_photos WHERE experience_id = ? ORDER BY n`)
    .all(id);
  return rows.map(mapPhoto);
}

export function experienceStops(id: string): ExperienceStop[] {
  const rows = getDb()
    .prepare(`SELECT * FROM experience_stops WHERE experience_id = ? ORDER BY n`)
    .all(id);
  return rows as unknown as ExperienceStop[];
}

/** Travel time from the conference's main venue to an experience. */
export function experienceTravel(experienceId: string, venuePlaceId: string | null): Travel | undefined {
  if (!venuePlaceId) return undefined;
  const row = getDb()
    .prepare(
      `SELECT mode, minutes FROM experience_travel WHERE experience_id = ? AND venue_place_id = ?`
    )
    .get(experienceId, venuePlaceId);
  return row ? { mode: row.mode as "walk" | "transit", minutes: row.minutes as number } : undefined;
}

export function experienceTags(id: string): Tag[] {
  const rows = getDb()
    .prepare(
      `SELECT t.* FROM tags t JOIN experience_tags et ON et.tag_id = t.id WHERE et.experience_id = ?`
    )
    .all(id);
  return rows as unknown as Tag[];
}

export function headlines(conferenceId: string): Headline[] {
  const rows = getDb()
    .prepare(`SELECT * FROM headlines WHERE conference_id = ?`)
    .all(conferenceId);
  return rows as unknown as Headline[];
}

export function headlineFor(conferenceId: string, kind: ExperienceKind): Headline | undefined {
  const row = getDb()
    .prepare(`SELECT * FROM headlines WHERE conference_id = ? AND kind = ?`)
    .get(conferenceId, kind);
  return row as unknown as Headline | undefined;
}

/** The place an experience happens at, from its first stop's plan row. */
export function experiencePlace(id: string): { name_en: string; name_ja: string; address: string | null } | undefined {
  const row = getDb()
    .prepare(
      `SELECT p.name_en, p.name_ja, p.address FROM experience_stops es
       JOIN plans pl ON pl.id = es.plan_id
       JOIN places p ON p.id = pl.place_id
       WHERE es.experience_id = ? ORDER BY es.n LIMIT 1`
    )
    .get(id);
  return row ? (row as unknown as { name_en: string; name_ja: string; address: string | null }) : undefined;
}

/** Simulated attendees who joined an experience (for "join others"). */
export function attendeesJoined(experienceId: string, limit = 12): Attendee[] {
  const rows = getDb()
    .prepare(
      `SELECT a.* FROM events ev JOIN attendees a ON a.id = ev.attendee_id
       WHERE ev.experience_id = ? AND ev.event_type = 'plan_joined'
       ORDER BY ev.ts
       LIMIT ?`
    )
    .all(experienceId, limit);
  return rows.map(mapAttendee);
}

export function attendeeById(id: string): Attendee | undefined {
  const row = getDb().prepare(`SELECT * FROM attendees WHERE id = ?`).get(id);
  return row ? mapAttendee(row) : undefined;
}

export function cityEstimates(): CityEstimate[] {
  const rows = getDb().prepare(`SELECT * FROM city_estimates ORDER BY start_date`).all();
  return rows as unknown as CityEstimate[];
}

export function seasonFor(month: number): Season | undefined {
  const row = getDb().prepare(`SELECT * FROM seasons WHERE month = ?`).get(month);
  return (row as unknown as Season) ?? undefined;
}

export function cityEventsBetween(from: string, to: string): CityEvent[] {
  const rows = getDb()
    .prepare(`SELECT * FROM city_events WHERE end_date >= ? AND start_date <= ? ORDER BY start_date`)
    .all(from, to);
  return rows as unknown as CityEvent[];
}

/** simulation_runs: scale factor per conference for the city view totals. */
export function simulationScales(): Map<string, number> {
  const rows = getDb().prepare(`SELECT conference_id, scale FROM simulation_runs`).all();
  const map = new Map<string, number>();
  for (const r of rows as any[]) map.set(r.conference_id, Number(r.scale));
  return map;
}

/** Committed spend rows (joined or booked) with the experience kind and area,
 * for the city view's splits. One row per event-log commit. */
export function committedSpend(conferenceId: string): { kind: string; area: string; area_ja: string; jpy: number | null }[] {
  const rows = getDb()
    .prepare(
      `SELECT e.kind AS kind, p.name_en AS area, p.name_ja AS area_ja, ev.price_jpy
       FROM events ev
       JOIN experiences e ON e.id = ev.experience_id
       LEFT JOIN places p ON p.id = e.area_id
       WHERE ev.conference_id = ? AND ev.event_type IN ('plan_joined','plan_booked')`
    )
    .all(conferenceId);
  return (rows as any[]).map((r) => ({
    kind: r.kind,
    area: r.area ?? "Other",
    area_ja: r.area_ja ?? "その他",
    jpy: r.price_jpy == null ? null : Number(r.price_jpy),
  }));
}

/** Reach per conference: attendees the organizer's link reached, and the total. */
export function reachByConference(): Map<string, { reached: number; total: number }> {
  const rows = getDb()
    .prepare(`SELECT conference_id, SUM(reached) AS reached, COUNT(*) AS total FROM attendees GROUP BY conference_id`)
    .all();
  const map = new Map<string, { reached: number; total: number }>();
  for (const r of rows as any[]) {
    map.set(r.conference_id, { reached: Number(r.reached), total: Number(r.total) });
  }
  return map;
}
