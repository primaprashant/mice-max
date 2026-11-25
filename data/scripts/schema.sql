-- MiceMax master schema (SQLite). See data/RECON.md and docs/07-data-plan.md.
-- Real tables:      source_url, confidence, checked_on, extra (JSON for unplanned useful fields).
-- Simulated tables: simulated = 1.
-- Lists are stored as JSON text. Dates ISO 'YYYY-MM-DD', times 'HH:MM', timestamps ISO 8601.
PRAGMA foreign_keys = ON;

-- ---------- Places ----------

CREATE TABLE places (
  id            TEXT PRIMARY KEY,           -- e.g. 'scc', 'otaru'
  name_ja       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('venue','area','station','airport','plan_site','event_site')),
  area_id       TEXT REFERENCES places(id), -- the area this place is in
  address       TEXT,
  lat           REAL,
  lng           REAL,
  source_url    TEXT NOT NULL,
  confidence    TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on    TEXT NOT NULL,
  extra         TEXT
);

-- Hand-entered transit. Walking is computed from lat/lng, not stored here.
CREATE TABLE routes (
  from_place_id      TEXT NOT NULL REFERENCES places(id),
  to_place_id        TEXT NOT NULL REFERENCES places(id),
  mode               TEXT NOT NULL CHECK (mode IN ('subway','tram','jr','bus','shuttle','taxi')),
  minutes            INTEGER NOT NULL,
  fare_jpy           INTEGER,             -- one way, per person
  last_departure     TEXT,                -- last return from to_place, 'HH:MM'
  reservation_needed INTEGER NOT NULL DEFAULT 0,
  note               TEXT,
  source_url         TEXT NOT NULL,
  confidence         TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on         TEXT NOT NULL,
  extra              TEXT,
  PRIMARY KEY (from_place_id, to_place_id, mode)
);

-- Per month. Sunset/sunrise are computed in code (astral), not stored.
CREATE TABLE seasons (
  month          INTEGER PRIMARY KEY CHECK (month BETWEEN 1 AND 12),
  high_c         REAL,
  low_c          REAL,
  precip_days    REAL,
  snowfall_cm    REAL,
  snow_depth_cm  REAL,
  sunshine_h     REAL,
  wear_ja        TEXT,   -- written by us
  wear_en        TEXT,
  highlights_ja  TEXT,   -- written by us
  highlights_en  TEXT,
  source_url     TEXT NOT NULL,
  confidence     TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on     TEXT NOT NULL,
  extra          TEXT
);

CREATE TABLE city_events (
  id          TEXT PRIMARY KEY,
  name_ja     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  place_id    TEXT REFERENCES places(id),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  hours       TEXT,
  status      TEXT NOT NULL CHECK (status IN ('confirmed','planned','expected')), -- expected = last year's pattern
  summary_ja  TEXT,
  summary_en  TEXT,
  source_url  TEXT NOT NULL,
  confidence  TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on  TEXT NOT NULL,
  extra       TEXT
);

-- ---------- Conferences ----------

CREATE TABLE conferences (
  id                  TEXT PRIMARY KEY,         -- e.g. 'jos131'
  series              TEXT,                     -- groups editions, e.g. 'jos'
  edition             INTEGER,
  previous_id         TEXT REFERENCES conferences(id), -- last edition, for demo events
  name_ja             TEXT,
  name_en             TEXT,
  name_en_ours        INTEGER NOT NULL DEFAULT 0,      -- 1 = no official English name, we wrote it
  start_date          TEXT NOT NULL,
  end_date            TEXT NOT NULL,
  end_weekday         TEXT,                     -- 'Mon'..'Sun'
  city                TEXT NOT NULL DEFAULT 'Sapporo',
  field               TEXT,                     -- medicine, engineering, science, agriculture, business, other
  field_detail        TEXT,                     -- e.g. 'ophthalmology'
  scope               TEXT CHECK (scope IN ('international','national','regional')),
  is_public           INTEGER,                  -- open to the public vs members only
  attendees           INTEGER,
  attendees_kind      TEXT CHECK (attendees_kind IN ('actual','expected','estimate')),
  attendees_onsite    INTEGER,                  -- when on-site and online are split
  overseas_attendees  INTEGER,
  countries           INTEGER,
  icca                INTEGER,                  -- 1 = ICCA-qualifying
  attendee_mix        TEXT,                     -- JSON {role: share}, with how it was derived in notes
  organizer           TEXT,
  pco                 TEXT,
  website_url         TEXT,
  program_status      TEXT CHECK (program_status IN ('full_online','partial','pdf_only','login_required','not_yet')),
  is_demo             INTEGER NOT NULL DEFAULT 0,
  source_url          TEXT NOT NULL,
  confidence          TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on          TEXT NOT NULL,
  notes               TEXT,
  extra               TEXT
);

CREATE TABLE conference_venues (
  conference_id  TEXT NOT NULL REFERENCES conferences(id),
  place_id       TEXT NOT NULL REFERENCES places(id),
  is_main        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conference_id, place_id)
);

-- Program of demo events. Same shape the app's conference reader outputs.
CREATE TABLE sessions (
  id             TEXT PRIMARY KEY,
  conference_id  TEXT NOT NULL REFERENCES conferences(id),
  basis          TEXT NOT NULL CHECK (basis IN ('published','moved_from_last')), -- moved = last edition's slot on the new dates
  day            TEXT NOT NULL,
  start_time     TEXT NOT NULL,
  end_time       TEXT NOT NULL,
  code           TEXT,                     -- organizer's session code, e.g. '1-SS7'
  title_ja       TEXT,
  title_en       TEXT,
  type           TEXT NOT NULL CHECK (type IN ('plenary','symposium','oral','poster','sponsor','social','excursion','other')),
  track          TEXT,
  room           TEXT,
  place_id       TEXT REFERENCES places(id),  -- building
  fee_jpy        INTEGER,                     -- receptions, banquets, excursions
  source_url     TEXT NOT NULL,
  confidence     TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on     TEXT NOT NULL,
  extra          TEXT
);

CREATE TABLE windows (
  id             TEXT PRIMARY KEY,
  conference_id  TEXT NOT NULL REFERENCES conferences(id),
  day            TEXT NOT NULL,
  start_time     TEXT NOT NULL,
  end_time       TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('early_morning','lunch','evening','free_afternoon','during_program','after_close','extra_night')),
  name_ja        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  overlaps_program INTEGER NOT NULL DEFAULT 0,  -- 1 = runs alongside sessions attendees may skip (D26)
  overlap_note   TEXT,                          -- what runs at the same time, e.g. 'parallel orals, posters'
  plan_kinds     TEXT,                          -- JSON experience kinds that fit, e.g. ['short','specialist']
  checked_by_human INTEGER NOT NULL DEFAULT 0
);

-- ---------- Plans ----------

CREATE TABLE plans (
  id                  TEXT PRIMARY KEY,
  kind                TEXT NOT NULL CHECK (kind IN ('short','evening','extra_night','specialist')),
  name_ja             TEXT NOT NULL,
  name_en             TEXT,
  place_id            TEXT NOT NULL REFERENCES places(id),   -- address, lat/lng live in places
  nearest_station     TEXT,
  station_walk_min    INTEGER,
  duration_min        INTEGER,
  -- One all-in number per person; the UI never adds prices.
  price_jpy           INTEGER,             -- "from" price, per person, all-in
  price_max_jpy       INTEGER,
  price_basis         TEXT CHECK (price_basis IN ('per_person','per_group')),
  price_variants      TEXT,                -- JSON [{name, price_jpy}]
  price_parts         TEXT,                -- JSON {stay, transport, activity, local_tax}: extra nights
  price_note          TEXT,                -- how the all-in price was computed
  drinks_included     INTEGER,
  party_min           INTEGER,
  party_max           INTEGER,
  private_room_max    INTEGER,
  opening_hours       TEXT,
  opens               TEXT,                -- 'HH:MM' earliest start, from data/raw/plans/hours.csv; NULL = any time
  closes              TEXT,                -- 'HH:MM' visit must be over by then ('24:00' = midnight)
  leave_by            TEXT,                -- extra nights: latest time to leave central Sapporo on day 1
  days_closed         TEXT,
  closed_periods      TEXT,                -- JSON [{from:'MM-DD', to:'MM-DD'}]
  months              TEXT,                -- JSON [1..12] when seasonal; NULL = all year
  booking_method      TEXT CHECK (booking_method IN ('online','phone','walk_in','none')),
  booking_url         TEXT,
  booking_deadline    TEXT,                -- e.g. '1 day before 11:59'
  booking_opens       TEXT,                -- e.g. '4 weeks ahead'
  cancellation_policy TEXT,
  payment             TEXT,                -- JSON ['cash','card','qr']
  smoking             TEXT CHECK (smoking IN ('none','separate','allowed')),
  tour_language       TEXT,                -- JSON ['ja','en']; tours only
  english_ok          INTEGER,
  age_min             INTEGER,
  free_shuttle        INTEGER,
  fields              TEXT,                -- JSON conference fields it suits (specialist)
  needs_agreement     INTEGER NOT NULL DEFAULT 0, -- specialist proposal without public tours
  highlight_en        TEXT,                -- factual line from the source
  partner_status      TEXT CHECK (partner_status IN ('contacted','interested','listed')),
  owner_tip_ja        TEXT,
  owner_tip_en        TEXT,
  source_url          TEXT NOT NULL,
  confidence          TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on          TEXT NOT NULL,
  notes               TEXT,
  extra               TEXT
);

CREATE TABLE tags (
  id        TEXT PRIMARY KEY,    -- ~20 tags, e.g. 'seafood', 'onsen', 'solo_ok'
  label_ja  TEXT NOT NULL,
  label_en  TEXT NOT NULL,
  icon      TEXT NOT NULL
);

CREATE TABLE plan_tags (
  plan_id  TEXT NOT NULL REFERENCES plans(id),
  tag_id   TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (plan_id, tag_id)
);

CREATE TABLE plan_photos (
  plan_id         TEXT NOT NULL REFERENCES plans(id),
  n               INTEGER NOT NULL,
  path            TEXT NOT NULL,          -- data/images/<plan_id>/<n>.jpg
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  dominant_color  TEXT,                   -- '#rrggbb', placeholder while loading
  focal_x         REAL,                   -- 0..1
  focal_y         REAL,
  alt_ja          TEXT,
  alt_en          TEXT,
  is_hero         INTEGER NOT NULL DEFAULT 0,
  ours            INTEGER NOT NULL DEFAULT 0,  -- taken by us during outreach
  image_url       TEXT,
  source_url      TEXT NOT NULL,          -- page the photo came from
  confidence      TEXT NOT NULL CHECK (confidence IN ('checked','reported','unsure')),
  checked_on      TEXT NOT NULL,
  extra           TEXT,
  PRIMARY KEY (plan_id, n)
);
CREATE UNIQUE INDEX one_hero_per_plan ON plan_photos(plan_id) WHERE is_hero = 1;

-- Written by an LLM from plans fields only.
CREATE TABLE plan_copy (
  plan_id       TEXT NOT NULL REFERENCES plans(id),
  lang          TEXT NOT NULL CHECK (lang IN ('ja','en')),
  card_title    TEXT NOT NULL,
  hook          TEXT NOT NULL,
  description   TEXT NOT NULL,
  included      TEXT,
  good_to_know  TEXT,
  checked_by_human INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, lang),
  CHECK ((lang = 'ja' AND length(card_title) <= 16) OR (lang = 'en' AND length(card_title) <= 40))
);

-- Computed once from places: venue → plan.
CREATE TABLE plan_travel (
  venue_place_id  TEXT NOT NULL REFERENCES places(id),
  plan_id         TEXT NOT NULL REFERENCES plans(id),
  mode            TEXT NOT NULL CHECK (mode IN ('walk','transit')),
  minutes         INTEGER NOT NULL,
  PRIMARY KEY (venue_place_id, plan_id)
);

-- ---------- Experiences: what the attendee sees ----------
-- One or more plans offered as one thing. Every plan is also a one-stop experience (same id);
-- combos (id 'combo-...') chain several plans. Built by import_experiences.py; columns are copied
-- or derived from the stops so the UI never has to combine plans itself.
CREATE TABLE experiences (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('short','evening','extra_night','specialist')),
  is_combo         INTEGER NOT NULL,
  stop_count       INTEGER NOT NULL,
  area_id          TEXT REFERENCES places(id),  -- area of the first stop
  duration_min     INTEGER,             -- start of first stop to end of last, travel included; NULL overnight
  start_from       TEXT,                -- 'HH:MM' earliest start so every day-1 stop is open; NULL = any time
  start_until      TEXT,                -- 'HH:MM' latest start (closing times, or leave_by for extra nights)
  price_jpy        INTEGER,             -- all-in per person: stop prices plus extra transport
  price_max_jpy    INTEGER,             -- one-stop only
  price_note       TEXT,
  party_min        INTEGER,             -- largest minimum of any stop
  party_max        INTEGER,             -- smallest maximum of any stop
  english_ok       INTEGER,             -- 1 only if every stop is; 0 if any is not
  needs_agreement  INTEGER NOT NULL DEFAULT 0,
  fields           TEXT,                -- JSON conference fields it suits
  months           TEXT,                -- JSON months every stop runs; NULL = all year
  days_closed      TEXT,                -- one line per stop for combos
  notes            TEXT
);

-- The one experience per kind that the demo opens live, with the window it is shown in.
CREATE TABLE headlines (
  conference_id  TEXT NOT NULL REFERENCES conferences(id),
  kind           TEXT NOT NULL CHECK (kind IN ('short','evening','extra_night','specialist')),
  experience_id  TEXT NOT NULL REFERENCES experiences(id),
  window_id      TEXT NOT NULL REFERENCES windows(id),
  start_time     TEXT NOT NULL,       -- suggested start, 'HH:MM'
  people_min     INTEGER NOT NULL,    -- simulated people who should have joined in this window
  people_max     INTEGER NOT NULL,
  note           TEXT,
  PRIMARY KEY (conference_id, kind)
);

CREATE TABLE experience_stops (
  experience_id  TEXT NOT NULL REFERENCES experiences(id),
  n              INTEGER NOT NULL,
  plan_id        TEXT NOT NULL REFERENCES plans(id),
  day            INTEGER NOT NULL DEFAULT 1,     -- 2 = the morning after (extra nights)
  offset_min     INTEGER NOT NULL,               -- minutes after the start of that day's part
  minutes        INTEGER,                        -- time spent at this stop
  travel_mode    TEXT CHECK (travel_mode IN ('walk','transit')),
  travel_min     INTEGER,                        -- from the previous stop
  price_jpy      INTEGER,                        -- what this stop adds to the all-in price
  what_ja        TEXT,                           -- what you do here, one line
  what_en        TEXT,
  PRIMARY KEY (experience_id, n)
);

-- Same columns as plan_copy. One-stop experiences copy their plan's copy.
CREATE TABLE experience_copy (
  experience_id TEXT NOT NULL REFERENCES experiences(id),
  lang          TEXT NOT NULL CHECK (lang IN ('ja','en')),
  card_title    TEXT NOT NULL,
  hook          TEXT NOT NULL,
  description   TEXT NOT NULL,
  included      TEXT,
  good_to_know  TEXT,
  checked_by_human INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (experience_id, lang),
  CHECK ((lang = 'ja' AND length(card_title) <= 16) OR (lang = 'en' AND length(card_title) <= 40))
);

-- Copied from plan_photos: all photos for one stop, each stop's hero for combos.
CREATE TABLE experience_photos (
  experience_id   TEXT NOT NULL REFERENCES experiences(id),
  n               INTEGER NOT NULL,
  plan_id         TEXT NOT NULL REFERENCES plans(id),
  path            TEXT NOT NULL,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  dominant_color  TEXT,
  focal_x         REAL,
  focal_y         REAL,
  alt_ja          TEXT,
  alt_en          TEXT,
  is_hero         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (experience_id, n)
);

CREATE TABLE experience_tags (
  experience_id  TEXT NOT NULL REFERENCES experiences(id),
  tag_id         TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (experience_id, tag_id)
);

-- Venue to the first stop, copied from plan_travel.
CREATE TABLE experience_travel (
  venue_place_id  TEXT NOT NULL REFERENCES places(id),
  experience_id   TEXT NOT NULL REFERENCES experiences(id),
  mode            TEXT NOT NULL CHECK (mode IN ('walk','transit')),
  minutes         INTEGER NOT NULL,
  PRIMARY KEY (venue_place_id, experience_id)
);

-- ---------- Simulated (demo events only) ----------

CREATE TABLE attendees (
  id                TEXT PRIMARY KEY,
  conference_id     TEXT NOT NULL REFERENCES conferences(id),
  name_ja           TEXT NOT NULL,      -- fake
  name_en           TEXT NOT NULL,
  role              TEXT NOT NULL,      -- e.g. 'ophthalmologist', 'resident', 'orthoptist', 'industry'
  career_stage      TEXT,
  home_prefecture   TEXT,
  home_country      TEXT NOT NULL DEFAULT 'JP',
  language          TEXT NOT NULL CHECK (language IN ('ja','en')),
  party             TEXT NOT NULL CHECK (party IN ('solo','colleagues','companion')),
  arrive_ts         TEXT,
  depart_planned_ts TEXT,
  interests         TEXT,               -- JSON, 2–3 of food, onsen, nature, running, drinks, culture, shopping
  budget_band       TEXT CHECK (budget_band IN ('low','mid','high')),
  tracks            TEXT,               -- JSON topics they follow (tracks, or words from session titles)
  lives_in_city     INTEGER NOT NULL,   -- 1 = local, not travelling
  reached           INTEGER NOT NULL,   -- organizer's link reached them
  simulated         INTEGER NOT NULL DEFAULT 1
);

-- One row per simulated demo conference. Multiply simulated totals by scale for the real size.
CREATE TABLE simulation_runs (
  conference_id        TEXT PRIMARY KEY REFERENCES conferences(id),
  conference_attendees INTEGER NOT NULL,
  simulated_attendees  INTEGER NOT NULL,
  scale                REAL NOT NULL,     -- conference_attendees / simulated_attendees
  seed                 TEXT NOT NULL,
  simulated            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE session_attendance (
  attendee_id  TEXT NOT NULL REFERENCES attendees(id),
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  simulated    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (attendee_id, session_id)
);

-- Same columns as the real event log. No names. Live-test rows use simulated = 0.
CREATE TABLE events (
  event_id       TEXT PRIMARY KEY,
  ts             TEXT NOT NULL,
  conference_id  TEXT NOT NULL REFERENCES conferences(id),
  attendee_id    TEXT,
  experience_id  TEXT REFERENCES experiences(id),
  window_id      TEXT REFERENCES windows(id),
  event_type     TEXT NOT NULL CHECK (event_type IN ('email_opened','page_visited','plan_shown','plan_opened','plan_saved','plan_joined','plan_booked','plan_cancelled','plan_removed_by_organizer')),
  channel        TEXT CHECK (channel IN ('email','qr','site')),
  party_size     INTEGER,
  price_jpy      INTEGER,
  simulated      INTEGER NOT NULL
);
CREATE INDEX events_conf_type ON events(conference_id, event_type);

-- ---------- Outreach (docs/08-outreach-plan.md, T10–T12). Organizations only, no personal names. ----------

CREATE TABLE contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,        -- O1..O9
  area        TEXT,
  phone       TEXT,
  email_or_form TEXT,
  department  TEXT,
  plan_id     TEXT REFERENCES plans(id),
  source_url  TEXT NOT NULL,
  checked_on  TEXT NOT NULL
);

CREATE TABLE outreach (
  id             INTEGER PRIMARY KEY,
  contact_id     TEXT NOT NULL REFERENCES contacts(id),
  date           TEXT NOT NULL,
  channel        TEXT NOT NULL,
  ask            TEXT,
  status         TEXT NOT NULL CHECK (status IN ('sent','replied','talked','yes','no')),
  reply_summary  TEXT,
  quote          TEXT,
  can_show_name  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE interviews (
  id               INTEGER PRIMARY KEY,
  date             TEXT NOT NULL,
  role             TEXT,
  home_prefecture  TEXT,
  answers          TEXT,          -- JSON {question: answer}
  quotes           TEXT,
  can_quote        INTEGER NOT NULL DEFAULT 0
);
