# MiceMax: data plan (hackathon)

What data the demo needs, where it comes from, where it is stored and who builds it. Each task below can be handed to one person or agent. Decisions behind it: D7, D11, D14, D17, D21–D25 in [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md).

## Goal

All three views should feel full, alive and curated, like a product someone cared about, not a conference site bolted together.

**The story the data tells:** "Last year this conference had this schedule and these attendees. If the same happens when it comes to Sapporo next year and MiceMax is used, here is what attendees would book and how much new money Sapporo would earn." Next to it, the city view shows the same estimate for every Sapporo conference in the next 12 months.

Three kinds of data, kept apart and labelled:

| Kind | What | Rule |
|---|---|---|
| **Real** | Conference list and stats, the two demo programs, plans, photos, places, seasons | Every row has `source_url` and `confidence` (checked / reported / unsure) |
| **Written** | Plan descriptions and window names in JA/EN | Written by an LLM from the real fields only. No new facts. A person checks the Japanese |
| **Simulated** | Attendees, sessions they attend, every click and booking. **Only for the two demo conferences** | Every row has `simulated = 1`, and the UI labels it. Uses only real plans and real prices |

All other conferences get **stats only** (dates, size, field, scope), no individual mock data.

## Storage

- **Master copy: one SQLite file, `data/micemax.db`, committed to the repo.** Every research result, written text and simulated row goes into it. Images stay as files in `data/images/`, with their paths in the database.
- **Scripts in `data/scripts/`:**
  - `schema.sql`: all tables. Written after the recon in T0, and changed whenever the research shows something new.
  - `import_*.py`: research agents save their output as CSV or JSON in `data/raw/`. A small import script loads it into SQLite. Raw files are kept, so a schema change means re-running the import, not redoing the research.
  - `simulate.py`: reads conferences, programs and plans from SQLite, writes attendees and events back. Fixed random seed, so re-running gives the same data.
  - `push_neon.py`, `push_neo4j.py`: wipe and reload the online databases from SQLite. Safe to run any time. Neon gets the event log and bookings; Neo4j gets the graph (conferences, windows, plans, places, attendees, joins).
- Connection strings come from a local `.env`, never committed.

### Tables

| Table | Rows | Filled by |
|---|---|---|
| `conferences`, `conference_venues` | Every Sapporo event we can find, Dec 2025–Nov 2027, plus the previous edition of each demo event | T1, T3 |
| `sessions`, `windows` | Program and free-time windows of the demo events | T3 |
| `plans`, `plan_photos`, `plan_copy`, `tags`, `plan_tags` | 80–100 real plans, their photos, JA/EN text, ~20 tags | T4–T6 |
| `plan_travel` | Minutes from each demo venue to each plan, computed from `places` | after T4, T7 |
| `places`, `routes`, `seasons`, `city_events` | Venues, areas, transit routes, monthly weather and highlights (sunset computed in code) | T7 |
| `attendees`, `session_attendance`, `events` | Simulated, demo events only | T8 |
| `contacts`, `outreach`, `interviews` | Real outreach, organizations only | T10–T12 |

## Rules for every research task

- **Search in Japanese and English, always.** Most of this information exists only in Japanese. Use 10+ Japanese search terms per task, not just one, plus their English equivalents, and read Japanese pages directly.
- Try synonyms and the words organizers actually use, e.g. for conferences: 学術集会, 学術大会, 総会, 年次大会, 学会, 国際会議, 開催予定, 札幌 開催; for plans: 体験, 日帰り, 宿泊プラン, 貸切, 団体 予約, 個室, 見学, 工場見学, 施設見学.
- Record names in both languages. If there is no official English name, write one and note it.
- Every result still needs a `source_url`, whatever its language.

## Tasks

Three streams run in parallel after T0:

```
A  T1 conference list → T2 pick 2 demo events → T3 programs, last edition ─┐
B  T4 plan list → T5 photos, T6 copy                                        ├→ T8 simulator → T9 push + check
C  T7 places and seasons                                                    ┘
```

### T0. Recon, then schema (~1.5 h, first)

**Done 2026-11-25:** [data/RECON.md](../data/RECON.md), [schema.sql](../data/scripts/schema.sql).

Look at a few real samples before deciding what to store. Don't collect data yet.

- **Conference lists:** the city MICE page [S1], the Convention Bureau's event list and the Convention Center calendar. What does each give (dates, size, field, link)? How far ahead?
- **Programs:** 3 conferences: one HTML program, one PDF-only, one previous edition. How are sessions, rooms, tracks and receptions shown? Is past attendance and attendee mix published anywhere?
- **Plans:** 2 samples each of short activity, evening, extra night and specialist visit. Which fields from [prompts/inventory-research.md](prompts/inventory-research.md) are actually findable? Are photos usable?

Write the findings in `data/RECON.md` (max 30 lines: what exists, where, in what form, what's missing), then write `data/scripts/schema.sql` from them. Every real table has `source_url, confidence, checked_on`; every simulated table has `simulated`. Drop fields nobody publishes. Add an `extra` JSON column to each real table for useful things we didn't plan for. Update the field list in the inventory prompt to match.

### T1. Conference list with stats (research agent, ~2 h)

Sapporo business events from **Dec 2025 to Nov 2027**. No cap: list every event with a public page, biggest first. Sapporo holds about 466 a year [S1], but most are small local meetings with no public page, so expect the list to cover the big national and international ones well and the small ones poorly. Feeds the city view's "next 12 months" estimate and the demo shortlist.

- **Sources:** city MICE page [S1], Sapporo Convention Bureau upcoming and past events, Sapporo Convention Center calendar, big hotels, Hokkaido University. Example searches: "札幌 学術集会 2027", "第◯回 日本◯◯学会 総会 札幌", "札幌コンベンションセンター 開催予定", "international conference Sapporo 2027".
- **Fields:** `id, name_ja, name_en, start_date, end_date, end_weekday, venue, field, field_detail, scope (international/national/regional), attendees (actual if past, expected if upcoming), overseas_attendees, organizer_or_pco, website_url, program_status (full_online/partial/pdf_only/login_required/not_yet), source_url, confidence, notes`.
- **Done when:** every row has a source, and a short note lists the top 3 domestic and top 3 international demo candidates.
- **Done 2026-11-25:** 269 events in `data/micemax.db`; shortlist and gaps in [data/raw/conferences/NOTES.md](../data/raw/conferences/NOTES.md). Rebuild with `python3 data/scripts/build_db.py`.

### T2. Pick the two demo conferences (human, 15 min)

One big domestic, one big international, both **upcoming in Sapporo, with last year's edition well documented**. Prefer: well known, 1,000+ attendees, last edition's full program and attendance online, clear free time, ends on a Friday or Saturday, different fields. Record the choice in Q9.

### T3. Demo events: last edition and upcoming edition (agent + human check, ~2 h)

For each demo event:

- **Last edition** (a row in `conferences`): dates, city, attendance, overseas share, who attended (members, residents, industry, co-medical staff) if published. Many national societies move city every year, so last year's edition was probably not in Sapporo. Record its city.
- **Program** (`sessions`): last edition's full program, moved onto the upcoming Sapporo dates and venue, labelled as such. If the upcoming program is already out, use it instead. Fields: `day, start, end, title_ja, title_en, track, room, type (plenary/symposium/oral/poster/sponsor/social)`, plus receptions and banquets.
- **Free windows** (`windows`), checked by a person: `day, start, end, kind (early_morning/lunch/evening/free_afternoon/during_program/after_close/extra_night), name_ja, name_en, overlaps_program, overlap_note, plan_kinds`. Windows may overlap sessions people commonly skip (D26).
- Use the **same shape the app's conference reader outputs**, so these rows double as the reader's test answers.

### T4. Plan list (research agent, ~3 h)

Run [prompts/inventory-research.md](prompts/inventory-research.md). 80–100 real items: ~30 short, ~25 evening, ~15 extra-night, ~15 specialist. Extra nights get the most care: all-in price (transport + stay + main activity) and how it was computed. Specialist visits must cover both demo events' fields (re-run that group after T2 if needed).

### T5. Photos (agent, ~1 h, after T4)

2–3 photos per plan, saved as `data/images/<plan_id>/1.jpg`, 1600 px wide, landscape, no text or logos on them, similar mood across plans. Source page of each photo goes in `plan_photos`. Copyrighted photos are fine for the demo (D21). Flag plans with no usable photo.

### T6. Plan copy in JA and EN (LLM + human check, ~1 h, after T4)

Per plan: title, a one-line hook, a 2–3 sentence description, what's included, and "good to know" (cash only, English OK, solo-friendly, last train). Written from `plans` fields only. A Japanese speaker reads the Japanese.

### T7. Places and seasons (agent, ~1.5 h)

- `places`: demo venues, New Chitose Airport, Sapporo Station, and each area (Odori, Susukino, Otaru, Jozankei, Yoichi, Noboribetsu, Toya…) with lat/lng, travel time and cost from central Sapporo.
- `seasons`: per month: typical high/low temperature, snow, sunset time, what to wear, seasonal highlights (Snow Festival, lilacs, YOSAKOI Soran, beer gardens, autumn leaves).
- `city_events`: festivals and events in Sapporo during the demo events' dates.

These let the attendee view say "Sunset 18:52, 14 °C, bring a light jacket" or "Lilac Festival is on in Odori Park, 8 minutes' walk".

### T8. Simulator (Python, ~4 h, can start with stub data)

`simulate.py` runs once per demo conference. Generic: no demo event names in the code.

**Attendees.** As many as attended the last edition. Fake name JA/EN, role from the conference field and last edition's mix (e.g. ophthalmologist, resident, orthoptist, industry), career stage, home prefecture or country, language, travel party (solo / colleagues / companion), arrival and planned departure, 2–3 interests (food, onsen, nature, running, drinks, culture, shopping), budget band. No real institutions (D23). Home prefectures reflect travelling to Sapporo, not last year's city.

**Reach.** Only attendees the organizer's link reaches (money model, [04-long-term-plan.md](04-long-term-plan.md#money-model)) get events. The rest exist, so the views can show "% reached".

**Sessions.** Each attendee follows 1–2 tracks and skips some sessions, so their free time is personal, not just the program's gaps.

**Event log** (`events`, same columns as the real log): `event_id, ts, conference_id, attendee_id, plan_id, window_id, event_type (email_opened, page_visited, plan_shown, plan_opened, plan_saved, plan_joined, plan_booked, plan_cancelled, plan_removed_by_organizer), channel (email/qr/site), party_size, price_jpy, simulated`. No names in the log.

**Behaviour, varied around the Middle scenario (D22):**

| Driver | Effect (Assumption) |
|---|---|
| Ends Friday or Saturday | about 2× extra-night rate |
| Overseas share | foreign attendees add extra nights about 6× as often [S9] |
| Season | ski and snow plans in winter, beer gardens and day trips in summer |
| Interest and price match | which plans an attendee opens and books |
| Others already joined | more likely to join, so popular plans emerge on their own |

Timing: registration waves, a bump after the organizer's email, extra-night bookings mostly weeks ahead (when flights are booked), short activities mostly in the last week and on site.

### T9. Push and check (~1 h)

Run `push_neon.py` and `push_neo4j.py`. Check:

- Each demo event's estimated new money sits inside the money model's Early–Strong range for its size.
- The city view's "next 12 months" figure is the money formula applied to each listed upcoming conference's stats, using the same drivers as the table above, plus one "other smaller meetings" row for the rest of the city's yearly total (about 466 events and 109,311 attendees [S1] minus the listed ones). Labelled as an estimate.
- No plan shows a price, time or place that isn't in `plans`.
- Real-looking variety: no plan nobody picks, no plan everybody picks.
- Everything simulated carries the label.

## Built for the UI

Store data in the shape the screens need, so the app doesn't patch it later. Include these in the schema (T0):

- **Photos:** width, height, dominant colour (for a coloured placeholder while loading), focal point (for clean crops at any size), alt text JA/EN, and one `is_hero` photo per plan.
- **Copy at fixed lengths:** card title (JA up to 16 characters, EN up to 40), one-line hook, detail text. Cards never truncate mid-word.
- **One tag list** of about 20 tags, each with a JA/EN label and an icon name. Research tags are mapped to it on import.
- **Travel time from each demo venue to each plan** (walk or transit minutes), worked out once from `places`, so cards can say "8 min walk".
- **Prices as one all-in number** per person plus what's included, so the UI never adds prices together.
- **Field content** from outreach ([08-outreach-plan.md](08-outreach-plan.md)): partner status, owner tips and our own photos.


Most of the delight comes from data, not styling. Check each view has:

- **Photos** on every plan, consistent in mood and crop.
- **Practical certainty:** walk time from *your* venue, "back by 18:30 for the reception", all-in price, cash or card, English OK.
- **The moment:** weather, sunset, what's in season and what's on in the city that week.
- **People:** "12 ophthalmologists joined, 3 from Kyushu", names and roles in "join others".
- **The city's story:** this conference's projected new money by type of spend and area, and next year's estimate for all of Sapporo, with the formula on screen.
