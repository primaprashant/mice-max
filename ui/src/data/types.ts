/** UI-side types. Mirrors the real tables in data/scripts/schema.sql, which is
 * the source of truth. Only the columns the screens use. */

export type SessionType =
  | "plenary"
  | "symposium"
  | "oral"
  | "poster"
  | "sponsor"
  | "social"
  | "excursion"
  | "other";

export type WindowKind =
  | "early_morning"
  | "lunch"
  | "evening"
  | "free_afternoon"
  | "during_program"
  | "after_close"
  | "extra_night";

export type ExperienceKind = "short" | "evening" | "extra_night" | "specialist";

export interface Conference {
  id: string;
  name_ja: string | null;
  name_en: string;
  start_date: string; // ISO date
  end_date: string;
  end_weekday: string | null;
  field: string | null;
  field_detail: string | null;
  scope: "international" | "national" | "regional" | null;
  attendees: number | null;
  overseas_attendees: number | null;
  main_venue_place_id: string | null;
}

export interface Session {
  id: string;
  conference_id: string;
  basis: "published" | "moved_from_last";
  day: string;
  start_time: string;
  end_time: string;
  title_ja: string | null;
  title_en: string | null;
  type: SessionType;
  track: string | null;
  room: string | null;
  fee_jpy: number | null;
}

export interface Window {
  id: string;
  conference_id: string;
  day: string;
  start_time: string;
  end_time: string;
  kind: WindowKind;
  name_ja: string;
  name_en: string;
  overlaps_program: boolean;
  overlap_note: string | null;
}

/** One experience: one plan or a combo. What the attendee sees as a card. */
export interface Experience {
  id: string;
  kind: ExperienceKind;
  is_combo: boolean;
  stop_count: number;
  area_id: string | null;
  duration_min: number | null;
  start_from: string | null;
  start_until: string | null;
  price_jpy: number | null;
  price_max_jpy: number | null;
  price_note: string | null;
  party_min: number | null;
  party_max: number | null;
  english_ok: boolean;
  needs_agreement: boolean;
  fields: string[];
}

export interface ExperienceCopy {
  card_title: string;
  hook: string;
  description: string;
  included: string | null;
  good_to_know: string | null;
}

export interface ExperiencePhoto {
  n: number;
  path: string; // public/images/...
  width: number;
  height: number;
  dominant_color: string | null;
  alt_ja: string | null;
  alt_en: string | null;
  is_hero: boolean;
}

export interface ExperienceStop {
  n: number;
  plan_id: string;
  day: number;
  offset_min: number;
  minutes: number | null;
  travel_mode: "walk" | "transit" | null;
  travel_min: number | null;
  price_jpy: number | null;
  what_ja: string | null;
  what_en: string | null;
}

export interface Travel {
  mode: "walk" | "transit";
  minutes: number;
}

export interface Tag {
  id: string;
  label_ja: string;
  label_en: string;
  icon: string;
}

/** The demo headline: the one experience per kind the demo opens live (D29). */
export interface Headline {
  conference_id: string;
  kind: ExperienceKind;
  experience_id: string;
  window_id: string;
  start_time: string;
  people_min: number;
  people_max: number;
  note: string | null;
}

export interface Attendee {
  id: string;
  conference_id: string;
  name_ja: string;
  name_en: string;
  role: string;
  home_prefecture: string | null;
  home_country: string;
  language: "ja" | "en";
  party: "solo" | "colleagues" | "companion";
  interests: string[];
  reached: boolean;
}

/** The attendee's calendar entry. Client-side in the demo, not in the database. */
export type PlanKind = "session" | "event";

export type PlanStatus = "attending" | "saved" | "joined" | "booked" | "cancelled";

export interface Plan {
  id: string;
  attendee_id: string;
  kind: PlanKind;
  ref_id: string;
  day: string;
  start: string;
  end: string;
  status: PlanStatus;
  party_size: number;
}

export interface CityEstimate {
  id: string;
  conference_id: string | null;
  name_en: string;
  start_date: string | null;
  end_weekday: string | null;
  season: string | null;
  events: number;
  attendees: number;
  overseas_share: number | null;
  xn_factor: number | null;
  early_jpy: number;
  middle_jpy: number;
  strong_jpy: number;
  basis: "formula_with_drivers" | "formula_plain";
}

export interface Season {
  month: number;
  high_c: number | null;
  low_c: number | null;
  wear_ja: string | null;
  wear_en: string | null;
  highlights_ja: string | null;
  highlights_en: string | null;
}

export interface CityEvent {
  id: string;
  name_ja: string;
  name_en: string;
  start_date: string;
  end_date: string;
  hours: string | null;
  status: "confirmed" | "planned" | "expected";
  summary_ja: string | null;
  summary_en: string | null;
}
