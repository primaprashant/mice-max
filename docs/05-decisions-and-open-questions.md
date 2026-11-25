# MiceMax: decisions and open questions

## Decisions

Made on 2026-11-24 unless noted. To change one, update this table and the brief it affects.

| # | Decision | Why |
|---|---|---|
| D1 | **Goal: more spend per business-event visitor, not more conferences.** | Sapporo's venue is full until about FY2033. Where a conference goes is decided years ahead by professors and association boards, and data from us won't change that. |
| D2 | **Extra nights first.** Then short activities and evenings, then specialist experiences. | Extra nights are the most clearly new money and produce most of it in every scenario. The city's own program targets "+1 night". |
| D3 | **Domestic attendees first, international fully supported.** | About 94% of attendees are Japanese. Kept, together with D2, after we learned that Japanese attendees add leisure nights far less often than foreign ones. The pilot must test this first (Q1). |
| D4 | **The city is the likely first paying customer. The business model is otherwise open.** | The city already funds this goal (¥3.99M in 2026). Commissions alone are too small. |
| D5 | **Product name: MiceMax.** | Team choice. |
| D5 | Name suggestions: Nezumi / Nezuko. MiceMax would appeal to a technical audience, the product should feel local. Nezuko also happens to be a protagonist of [Demon Slayer](https://en.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba), bringing in impressions of cuteness, mickey mouse, etc (hypothesis) |
| D6 | **Hackathon demo: one conference link → organizer, attendee and city views.** | Shows the whole loop: easy for organizers, useful for attendees, valuable for the city. |
| D7 | **Demo uses two real events, one big domestic and one big international.** **Chosen 2026-11-25 (T2): 32nd Japanese Association for Disaster Medicine (JADM32, Mar 18–20 2027) and ICEP2027 (May 12–15 2027).** | Proves it works on any conference, not one we hard-coded. |
| D8 | **Mock checkout, Japanese + English, simulated city numbers clearly labelled.** | Real payments and live inventory can't be done well in 2 days, and the legal position on payments isn't clear yet (Q7). |
| D9 | **"Join others" is in the demo as a small feature.** | Many attendees travel alone. It is also a natural use of a graph database. |
| D10 | **Neo4j filters what is possible, TypeSafe's Jev picks what is best, an LLM through OrcaRouter writes the words.** Other partners only if they truly fit. | Each tool does the job it is best at. Neo4j also offers a special prize. Jev is in early access, so the LLM is the fallback. |
| D11 | **The activity list is built separately by an AI agent and checked by a person.** | Keeps invented places and prices out of the demo. |
| D12 | **Long-term path: Sapporo → other Hokkaido cities (Hakodate first) → other Japanese conference cities.** | Hokkaido alone is too small. The same problem and budgets exist in every major conference city. |
| D13 | **Not pursuing for now:** helping professors host small international meetings; matching exhibition visitors with local companies. | Both could be large, but they are slow to prove and far from the core product. Revisit after a pilot. |
| D14 | **We estimate money only with the formula in [04-long-term-plan.md](04-long-term-plan.md#money-model).** Never "every attendee × ¥X". | Uptake is never 100%, and some spending would have happened anyway. |
| D15 | **Stretch goal: 15–30 second preview videos for plans**, with real photos, PixVerse motion and an ElevenLabs or Fish Audio voiceover. | Extra-night decisions are emotional and made early; video persuades better than text. Only after the must-haves work. |
| D16 | **A few charts in the briefs (PNG), drawn by a script kept in the folder.** | People look at pictures before they read. The script lets anyone redraw the charts when the numbers change. |
| D17 | **Log every interaction from day 1, including plans shown but not picked, in an append-only event log (Postgres). Build a data flywheel on it. In the hackathon, demo it as a stretch goal with simulated past conferences.** | Data on what attendees at similar conferences chose is what competitors can't copy, and it can't be collected after the fact. Logging is cheap now and very hard to add later. |
| D18 | **Attendee view shows one timeline: conference sessions and free-time plans together.** | Attendees shouldn't cross-check two schedules; one view cuts missed plans and cancellations. From PR review, 2026-11-24. |
| D19 | **City view shows attendees reached as a count and as a % of each conference.** | The count feeds the money formula ([04-long-term-plan.md](04-long-term-plan.md#money-model)); the % makes conferences of very different sizes comparable. |
| D21 | **Hackathon data: detailed mock data only for the two demo conferences, built from each one's last edition (schedule, attendance). All other Sapporo conferences (Dec 2025–Nov 2027) get stats only. Copyrighted photos are allowed for the demo.** | Shows "if this conference uses MiceMax next year, Sapporo earns ¥X" with believable detail, without simulating 80 events. Stats are enough for the city-wide estimate. Photos are a demo-only shortcut, replaced before launch. |
| D22 | **Mock attendee behaviour varies around the Middle scenario**, driven by end weekday, overseas share, season, interests and how many others joined. | Flat numbers look fake. Varied ones give the city view real patterns to show, and stay inside the money model's range. |
| D23 | **Mock attendees show a fake name, role and home prefecture or country. No real institutions.** | Feels alive in "join others" without implying real people or hospitals attend. |
| D24 | **A local SQLite file (`data/micemax.db`) is the master copy of all data.** Scripts wipe and reload Neon and Neo4j from it. | One place to fix data; the online databases can be rebuilt any time. |
| D25 | **Do real outreach during the hackathon: attendee interviews, local businesses, organizers and PCOs, the city and Convention Bureau, plus one live test with hackathon participants.** See [08-outreach-plan.md](08-outreach-plan.md). | Shows judges this is already happening, not theory, and gives first real answers to Q1–Q8. |
| D20 | **The "attendees like you picked…" stretch goal starts with plain counts** ("Attendees at your conference signed up for…", "Attendees in Sapporo this week signed up for…") before any similarity matching. | Seeing who is joining sparks more joins, and counts need no ML. |

## Open questions

Ordered by how much the answer could change the plan. None of them can be answered from public data. They need conversations or a pilot.

| # | Question | Why it matters | How to test it |
|---|---|---|---|
| Q1 | **Will Japanese attendees add an extra night because of an offer?** | D2 and D3 depend on it. In Kyoto, foreign attendees added leisure nights more than 6 times as often as Japanese ones. Work, weekdays and university travel rules may stop them. | Ask 5–10 Japanese doctors and researchers: "Have you ever stayed on after a conference? What would make you?" In the pilot, compare planned and actual departure dates. Check whether conferences ending on a Friday or Saturday do better. |
| Comment | | | Anecdotally, Japanese coworkers in the tech industry return on the last day of the conference (even when travelling overseas). Bueracratic headache might make it difficult for people to extend their trips after the end date. |
| Q2 | **Do attendees have free time?** | Receptions (懇親会), sponsor seminars and lab dinners may already fill the evenings. | Ask attendees or a PCO: "How many free evenings did you have at your last Sapporo conference?" Check published programs for evening events. |
| Comment | | | Attendees might not want to attend _ALL_ program events, they might skip duplicate talks or topics of their expertise/lack of interest |
| Q3 | **Will organizers and PCOs share our link?** | They are the only way to reach attendees early. | Ask 2–3 PCOs (e.g. Nihon Convention Service, Convention Linkage, JTB Communication Design) and the Convention Bureau. |
| Q4 | **Will the city pay for software instead of a hand-built program?** | D4. | Ask the city's tourism and MICE section: what did the 2026 program measure, will it run again in FY2027, and could it cover all conferences? |
| Q5 | **How much of the activity spend is truly new?** | Moving dinner from one restaurant to another adds nothing for the city. | Split test in the pilot (see [04-long-term-plan.md](04-long-term-plan.md#how-we-prove-it-is-new-money)). |
| Q6 | **Will businesses take our bookings and pay a fee?** | Supply and part of our income. | Ask 3–5 restaurants and activity operators about group bookings on conference nights and the fees they would accept. |
| Q7 | **What do we need legally to take payments?** | Bundles with transport or lodging likely need travel agency registration. | Ask a licensed administrative scrivener (行政書士) in Hokkaido before taking real payments. |
| Q8 | **Do domestic attendees need us, or do Tabelog and Hot Pepper already do the job?** | 94% of the market. | Ask 3 Japanese attendees how they chose dinner and weekend plans last time, and with how many people. |
| Q9 | ~~Which two events do we demo?~~ **Answered 2026-11-25:** JADM32 and ICEP2027 (D7). | Both end on a Saturday. Neither has a 2027 program yet, so the demo uses last edition's program moved onto the 2027 dates. | Shortlist in [data/raw/conferences/NOTES.md](../data/raw/conferences/NOTES.md). |
| Q10 | **If the venue is full, how did Sapporo host about 115 events in 2018?** (raised in PR review) | Tests D1's claim that hosting more conferences isn't possible until FY2033. | Get the city's yearly convention counts and the venue's turn-away history; check whether "115" is an ICCA count (stricter definition, not comparable with [S1]). |
| Q11 | **Should 01-evidence show conference counts for more years?** (raised in PR review) | A multi-year series would show growth (or a ceiling) more convincingly than 2024–2025 alone. | Pull earlier years from the same city source as [S1] and add them with labels if they are comparable. |
| Q12 | **Should the program PDF, not the URL, be the main input?** (raised in PR review) | Some conferences put their program behind a login, so a link may not work. The demo headline is built on pasting a link. | Check how many candidate demo conferences publish a full program without login, and how many only as PDF. If most need a PDF, update the headline, the demo story and the judging answer together. |
