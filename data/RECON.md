# T0 recon (2026-11-25)

Details and sample rows: [raw/recon/](raw/recon/) (`conference-lists.md`, `programs.md`, `plans.md`, `places-seasons.md`).

**Conference lists.** No single source covers Dec 2025–Nov 2027; combine four.
- UMIN meeting lists (medical only, ~1.5 years ahead): dates, name, society, venue. No size or field.
- City MICE page [S1]: 23 major events Apr 2026–Mar 2027, broad field, venues. No sizes, nothing after Mar 2027 yet.
- bizevent-navi.com (Hokkaido): ~26 events, field and subfield, link. Only upcoming source covering non-medical events.
- Convention Center calendar: ~4 months ahead, organizer, public or closed. Mixed with non-MICE events.
- Past actuals: JNTO per-event data (international only, 2015–2024). Expected sizes are rarely published. Convention Bureau JA site returns 403; hotels publish nothing.

**Programs.** None of the 6 candidates has a full upcoming program (2 not_yet, 4 partial). No login walls.
- Previous editions (JOS130 HTML, JADM31 daily PDFs, ICEP2026 grid PDFs) give day, start, end, room, type, title_ja, chairs and a session code. Track only at international meetings; title_en only for English sessions.
- Big meetings use several buildings (JSGE112 used two cities). Receptions and excursions sit in separate PDFs.
- Free time is explicit only at international meetings. Japanese ones run ~7:50–19:20, so windows are mostly evenings and the last day.
- Some grid PDFs (JOS, JSGE) extract as garbled text: need vision/OCR.
- Attendance: totals only (JOS130 8,763 registered / 4,417 on-site; ICEP2026 1,191 incl. 258 overseas). No mix by role anywhere; use fee categories and society membership as a proxy.
- All last editions were outside Sapporo.

**Plans.** Findable: name_ja, address, nearest station and walk, hours, closed days, booking method and URL, price (tours, courses, hotels), group size, duration.
- Not published, so dropped: lat/lng and walk time from the venue (computed from the address), restaurant languages, vegetarian tag, seasons (use closed periods).
- Added: booking deadline, party min/max, private room size, smoking, price variants, drinks included, age limit, tour language, cancellation, free shuttle, local tax.
- Extra-night all-in price = room for 2 ÷ 2 + return fares + main activity + local taxes. Store the parts and the date checked.
- Photos: only some official heroes reach 1600 px; most are ~1000 px, listing sites ≤600 px. Ask partners for photos during outreach.
- No bookable guided morning run exists; offer it as a self-guided route.

**Places and seasons.** Climate from JMA monthly normals. Sunset computed in code (`astral`), not stored. ~10 routes hand-entered (fare, minutes, last departure; the Jozankei bus needs booking). Walk minutes = straight line × 1.3 ÷ 80 m/min. 2027 dates exist for Snow Festival, YOSAKOI, Shrine Festival, Autumn Fest; Lilac, Beer Garden and others marked "expected". What to wear and highlights we write ourselves.
