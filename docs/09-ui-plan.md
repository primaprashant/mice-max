# MiceMax: UI plan

The bare minimum UI screens to make. Read with [03-hackathon-scope.md](03-hackathon-scope.md), [07-data-plan.md](07-data-plan.md) and [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md).

The data is built ([07-data-plan.md](07-data-plan.md), T0–T9): one SQLite master copy, pushed to Neon (a copy of every table) and Neo4j Aura (the graph). The UI reads Neon through one data module. The demo conferences are JADM32 and ICEP2027 (Q9 in [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md)). See "Data" below.

A foundations skeleton exists on this branch in [ui/](../ui/): an Astro 7 + Tailwind 4 project with the layout, theme tokens, language module, `PlanCard`, `SimulatedLabel`, `Header`, and a data module reading dummy JSONs. [ui/README.md](../ui/README.md) describes it. Build the screens on it; do not start from an empty folder.

## Views

### Organizer view

1. Two paths into the conference view: an "upload program" button for the PDF upload, and an "emulate read" button that goes to the next page directly with a stored program (JADM32 or ICEP2027 in `sessions`). The upload path shows a progress state while the read runs, and an error state with retry if it fails. (Q12 asks whether URL or PDF should be the main input; check it before building.)
2. The program shows as a calendar, with free-time windows marked. Window kinds: early morning, lunch, evening, free afternoon, extra night, and windows that run alongside sessions people may skip (D26).
3. Suggested plans for each window. The organizer approves or removes each with one click (must-have in [03-hackathon-scope.md](03-hackathon-scope.md)).
4. A share screen: attendee page link, QR code, and ready-to-send email text in Japanese and English.

### Attendee view

Simple login page: name, plus a password field that is never checked. The login page also carries the consent line for event logging ([04-long-term-plan.md](04-long-term-plan.md): attendees agree on first use, no names in the log).

Then a calendar view with the conference sessions (in default theme color) and our events (in a yellow banana color). Scroll down to see all available events (like connpass).

1. Home view (calendar) has their icon at the top right corner.
2. Events have the following details: Title, Place, Other attendees who are joining (circular icons), somewhat like luma. A price if chargable.
3. Clicking on an event shows luma-esque home page: <https://luma.com/m4if17ik>. You can sign up, or have to pay.
4. Payment page is dummy only.
5. Once signed up, change the event page accordingly.
6. Update the home view (calendar) to include the events user signed up for.
7. Extra-night plans come first in the docs (D2), and they are not calendar slots. Give them their own surface: a card or banner above the scroll list. Example: "Stay Saturday night at a Jozankei onsen", one all-in price.

Free-time windows are visible on the calendar, because plans are offered per window.

No onboarding screen. The attendee lands straight on the calendar. Name and consent are on the login page, language is the header toggle, and interests stay out of scope for the demo. Instead of a wizard, surface personalization in place: a dismissible banner on first visit, for example "Thursday evening is free. 3 plans fit." Reason: the attendee arrives from a link or QR with one goal, to see the schedule; a wizard between login and calendar adds a screen the docs do not require.

### City view

A single page dashboard. Per [03-hackathon-scope.md](03-hackathon-scope.md) and D19:

1. Attendees reached: a count and a % of each conference's attendees, per conference and in total.
2. Plans booked, extra nights, estimated new spend. Split by type of spend (extra night, short activity, specialist) and by area (Sapporo, Otaru, Jozankei...).
3. The money formula shown on screen.
4. Every number labelled as simulated.

## Foundations

Things every view needs. Build once, share everywhere.

1. Language toggle. English is the default. Displayed strings come from a language module with two files, `en.json` and `ja.json`; for now the files are identical. The docs require Japanese as the primary language and English complete, not partial, so no screen hardcodes strings.
2. Shared plan components. One calendar block and one card render any plan (session or event), colored by kind: sessions in theme color, our events in banana yellow.
3. Simulated label. One component that marks data as simulated, used in the city view and wherever simulated data shows.
4. Consent line. One sentence on the login page.
5. Theme tokens: the default theme color, banana yellow for our events.

## Event data

Three terms. The word "plan" means a calendar entry here, and an ingredient in the data ([07-data-plan.md](07-data-plan.md)); both uses stay.

- Session: an item on the conference's official program (talk, poster, reception). Comes from the organizer side. Stored in `sessions`.
- Event: something we provide that the attendee can join or book (short activity, evening, extra night, specialist). This is what the data calls an **experience** (D27). Stored in `experiences`.
- Plan: an attendee's calendar entry. It points at either a session or an event. The calendar is the attendee's plans, whatever they point to. Stored in the `plans` UI table below.

### Schema

The real tables live in [data/scripts/schema.sql](../data/scripts/schema.sql) and are the source of truth. The UI reads them through the data module; it does not define its own schema. The tables the screens need, and how each column is used:

sessions — the calendar's session blocks

- `id, conference_id, day, start_time, end_time, title_ja, title_en, track, room, type`, `basis` (`published` = the upcoming program; `moved_from_last` = last edition's slot moved onto the new dates; show the label on the organizer's program view)
- `fee_jpy` for receptions, banquets and excursions

windows — the free-time blocks the calendar marks and cards are offered per window

- `id, conference_id, day, start_time, end_time, kind, name_ja, name_en`
- `overlaps_program, overlap_note`: windows that run alongside sessions people may skip (D26)
- `checked_by_human`: windows that passed a person's check (T3)

experiences — the cards. One plan or a combo (D27)

- `id, kind` (short, evening, extra_night, specialist), `is_combo, stop_count, area_id`
- `start_from, start_until`: earliest and latest start so the UI can say what still fits the window
- `duration_min`, `price_jpy` (one all-in number per person; the UI never adds prices), `price_note`, `party_min, party_max`
- `english_ok, needs_agreement, fields, months, days_closed`

experience_copy — card text per language, at fixed lengths (JA title 16 characters, EN 40)

- `card_title, hook, description, included, good_to_know`, `checked_by_human`

experience_photos — card and page images with placeholder color and crop

- `path, width, height, dominant_color, focal_x, focal_y, alt_ja, alt_en, is_hero`

experience_travel — "8 min walk" on the card

- `venue_place_id, mode (walk/transit), minutes`

experience_stops — the combo timeline

- `n, plan_id, day, offset_min, minutes, travel_mode, travel_min, price_jpy, what_ja, what_en`

experience_tags, tags — the shared ~20 tags with JA/EN label and icon

headlines — the one experience per kind the demo opens live (D29), with its window and the size of its simulated group

plans (UI table) — the attendee's calendar entries; not in the database yet, client-side for the demo

- id, attendee_id
- kind: session or event
- ref_id: the session id or experience id it points at
- day, start, end: copied onto the plan at sign-up, so the calendar renders one row type without joins
- status: attending (session), saved, joined, booked, cancelled
- party_size

The city view reads `city_estimates` (per conference, plus the `other` row for smaller meetings) and `conferences` for dates and sizes. "Join others" and "% reached" read the `events` log and `attendees` (`reached`, `role`, `home_prefecture`, `home_country`). The attendee view's moment line reads `seasons` (month's weather and what to wear) and `city_events`; the day's sunset is computed in code, not stored.

## Data

- Astro server endpoints query Neon with the connection string from `.env` (never committed). The client islands fetch from these endpoints; they never see the connection string.
- The dummy JSONs in `ui/src/data/dummy/` use a made-up conference and the old UI-only schema (`events` with `window_ids`, `capacity`, `spots_left`). Delete them in the swap: the data module's functions now select from the real tables. Keep the same function names so the screens don't change. `types.ts` needs the same rewrite; the current `Session`, `Window`, `Event` types don't match the schema.
- Anything Neo4j computes (matching, ranking) is computed in a server endpoint and returned as JSON. The browser never talks to Neo4j or Neon directly.
- Write access (booked, cancelled, removed_by_organizer) appends to the `events` log table.
- Local data: `data/micemax.db` committed to the repo; rebuild with the commands in [07-data-plan.md](07-data-plan.md) T9. Local development reads it when no Neon connection is set, so every screen works offline.
- Photos are files in `data/images/<plan_id>/<n>.jpg`, committed to the repo; `plan_photos.path` and `experience_photos.path` hold those paths. Serve them from the Astro `public/` folder (a build step or symlink copies them), not from `image_url`, which is the page the photo was fetched from and is unreliable to hotlink.
- What the data holds, for planning the screens: 96 plans built into 109 experiences (13 combos), 24 tags, photos for 104 of 109 experiences, travel times from 3 venues, 281 sessions and 33 windows per demo conference, 2,000 simulated attendees (1,000 each, `simulation_runs.scale` scales totals up), 15,737 event-log rows. All 281 sessions are `moved_from_last`; no window has `checked_by_human = 1` yet. The city estimate covers 32 rows (31 conferences plus `other`): Early ¥3.3M, Middle ¥32.5M, Strong ¥167.5M over Dec 2026 to Nov 2027.
- `headlines` names the 8 experiences (4 per demo conference, one per kind) the demo opens live. Build their screens first and make them right; other experiences may be less exact (D29).

## Tech stack

- Astro for the UI. Static pages and components by default, with small client-side islands where a screen needs interaction (calendar, event page, mock checkout, organizer actions).
- Data comes from Neon, read through one data module, so screens never query it directly. Local development without a connection falls back to committed data ([07-data-plan.md](07-data-plan.md): the SQLite master copy is in the repo).

## Screens and states to add

- Attendee: calendar loading state, a free-time window with no plans, payment failure state, and the calendar after a booking.
- City view: empty state before data exists.
- Desktop only. Mobile is out of scope for now.

## Build and review notes

- Phases: a build order where each phase ends with a check. For example: attendee calendar, then event page and dummy payment, then organizer flow, then city view. Local development uses the SQLite master copy when no Neon connection is set, so every screen works offline.
- Edge cases, listed per view: a conference with no free windows, a booking for a date in the past.
- Product decisions: one line per UI decision and its reason, so a reviewer sees why a screen looks the way it does.
- Trade-offs: what the demo simplifies and what production changes. The `plans` UI table lives in the browser instead of the database, and the payment page is dummy.
- Navigation page: one static page with links to every screen in demo order, so each screen is reachable without a live flow. Build it last, once the screens exist.
- Checks before you call a phase done: `npm run build` passes, no screen hardcodes a string (the i18n module throws on a missing key), and every simulated number carries the simulated label.
