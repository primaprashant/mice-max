# Prompt: build the MiceMax activity and venue list

Give this prompt to a research agent with web access. A person checks the output before the demo uses it.

---

You are building a list of real, bookable things that business-event visitors to Sapporo can do in their free time. It feeds a product called MiceMax, which shows conference attendees plans that fit around their sessions. Most users are Japanese professionals (doctors, researchers, engineers) attending national conferences. Some are international attendees.

**Find 60–80 items in four groups:**

1. **Short activities (1–3 hours):** early-morning runs or running clubs, specialty coffee tours or standout cafés, guided walking tours, market visits, onsen or sento near the centre, short cultural experiences.
2. **Evenings:** restaurants and izakaya that can take groups of 4–10 people, within about 20 minutes' walk of Sapporo Convention Center, Odori or Susukino. Mix price bands and cuisines (seafood, Genghis Khan, soup curry, ramen, sushi).
3. **Extra-night plans (one night, from Sapporo):** Otaru, Jozankei onsen, Yoichi wineries and distillery, Noboribetsu, Lake Toya, and in winter, ski or snow activities. Give transport time and a total price estimate per person (transport + stay + main activity).
4. **Specialist visits:** research facilities, labs, farms, factories or institutions that accept visitors and would interest a specialist audience (medicine, chemistry, engineering, agriculture, energy). Mark each one "proposal: needs agreement" unless public tours exist.

**For each item, record:**
`name_ja`, `name_en`, `group` (short / evening / extra_night / specialist), `area`, `address`, `lat`, `lng`, `walk_minutes_from_convention_center` (or transport time for extra nights), `duration_minutes`, `price_jpy_min`, `price_jpy_max`, `price_basis` (per person / per group), `group_size_max`, `opening_hours`, `days_closed`, `seasons` (which months it runs), `languages`, `booking_method` (online / phone / walk-in / none), `booking_url`, `payment` (cash only / card / QR), `tags` (e.g. seafood, non-smoking, vegetarian-friendly, solo-friendly), `source_url`, `checked_on` (date), `confidence` (checked / reported / unsure), `notes`.

**Rules:**

- Every item must exist and have a source URL. Never invent a place, price or opening hour. If a field is unknown, leave it empty.
- Prefer official sites. Use review or listing sites only when there is no official site, and set `confidence` to "reported".
- Drop anything that is closed, seasonal and out of season for March–September 2027, or has no way to book or visit.
- Drop bars or venues with any public reports of overcharging or touting.
- Output one CSV file plus a short note listing gaps (e.g. "few group-friendly places near the Convention Center").
