# MiceMax: UI plan

The bare minimum UI screens to make. Read with [03-hackathon-scope.md](03-hackathon-scope.md), [07-data-plan.md](07-data-plan.md) and [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md).

Data comes from a dummy folder of JSONs so we can move fast. Later the same calls hit the database ([07-data-plan.md](07-data-plan.md)), so keep the data access in one place. Demo conferences will be added shortly (Q9 in [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md)).

## Views

### Organizer view

1. Two paths into the conference view: an "upload program" button for the PDF upload, and an "emulate read" button that goes to the next page directly with sessions from dummy data. The upload path shows a progress state while the read runs, and an error state with retry if it fails. (Q12 asks whether URL or PDF should be the main input; check it before building.)
2. The program shows as a calendar, with free-time windows marked (early morning, lunch, evening, free afternoon, day after the conference).
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

Three terms:

- Session: an item on the conference's official program (talk, poster, reception). Comes from the organizer side.
- Event: something we provide that the attendee can join or book (short activity, evening plan, extra night, specialist visit). This is what [07-data-plan.md](07-data-plan.md) calls a "plan".
- Plan: an attendee's calendar entry. It points at either a session or an event. The calendar is the attendee's plans, whatever they point to.

### Schema

sessions

- id, conference_id
- day, start, end
- title_ja, title_en
- track, room
- type: plenary, symposium, oral, poster, sponsor, social

events

- id, conference_id
- window_ids: which free-time windows it fits
- type: short_activity, evening, extra_night, specialist
- title_ja, title_en, hook_ja, hook_en, description_ja, description_en
- place_id, area
- price_jpy: one all-in number per person; price_includes
- duration_min, travel_min_from_venue
- capacity, spots_left
- tags: from the shared tag list in [07-data-plan.md](07-data-plan.md)
- photos
- source_url, confidence: the real-data rule in [07-data-plan.md](07-data-plan.md)

plans

- id, attendee_id
- kind: session or event
- ref_id: the session id or event id it points at
- day, start, end: copied onto the plan at sign-up, so the calendar renders one row type without joins
- status: attending (session), saved, joined, booked, cancelled
- party_size

## Tech stack

- Astro for the UI. Static pages and components by default, with small client-side islands where a screen needs interaction (calendar, event page, mock checkout, organizer actions).
- Data comes from a dummy folder of JSONs, read through one data module, so the same calls hit the database later and the swap is a one-file change ([07-data-plan.md](07-data-plan.md)).
- Anything Neo4j computes (matching, ranking) lands in the JSONs first. The browser never talks to Neo4j directly.

## Screens and states to add

- Attendee: calendar loading state, a free-time window with no plans, payment failure state, and the calendar after a booking.
- City view: empty state before data exists.
- Desktop only. Mobile is out of scope for now.

## Build and review notes

- Phases: a build order where each phase ends with a check. For example: attendee calendar, then event page and dummy payment, then organizer flow, then city view.
- Edge cases, listed per view: a conference with no free windows, a booking for a date in the past.
- Product decisions: one line per UI decision and its reason, so a reviewer sees why a screen looks the way it does.
- Trade-offs: what the demo simplifies and what production changes. Dummy JSON instead of an event log is the main one.
- Navigation page: one static page with links to every screen in demo order, so each screen is reachable without a live flow. Build it last, once the screens exist.
