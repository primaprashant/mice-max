# MiceMax: hackathon scope (2 days)

This brief sets the scope for what we build at the hackathon. The vision ([02-vision.md](02-vision.md)) is broader. Anything not listed under "Build" is out of scope.

## The one thing the demo must prove

**Paste a real conference link and, within a few minutes, MiceMax produces a working attendee page full of plans that fit that conference's free time. A city view then shows what that could be worth to Sapporo.**

Everything else supports that loop.

## Demo story (end to end)

1. **Organizer view.** Paste a conference URL (or upload the program PDF). The AI reads it and shows:
   - dates, venues and session times;
   - the attendees' **free time windows**: early morning, lunch, evenings, any free afternoon, and the day after the conference ends;
   - suggested plans for each window, which the organizer can approve or remove with one click;
   - outputs to share: an attendee page link, a QR code and ready-to-send email text in Japanese and English.
2. **Attendee view** (Japanese and English).
   - **One timeline** for this conference: sessions and free-time windows together, with the attendee's chosen plans placed in their windows. One view means no cross-checking two schedules and fewer missed plans or cancellations.
   - Plans for each window, across the three ways to spend:
     - **extra night** after the conference (e.g. Otaru, Jozankei onsen, Yoichi wineries), with an all-in price;
     - **short activities** in free time: morning run, specialty coffee tour, walking tour, brewery tour, group dinner;
     - **specialist experiences** matched to the conference topic (e.g. a research facility for a science conference).
   - **Join others:** see which plans other attendees from the same conference have joined, and join them. This is especially useful for people travelling alone.
   - **Mock checkout:** looks real, charges nothing. In real use the attendee pays the local business for the plan they book; MiceMax earns a commission, and the city pays separately to run the service (see [04-long-term-plan.md](04-long-term-plan.md#revenue-to-micemax)).
3. **City view.**
   - Attendees reached (count, and % of each conference's attendees, since conference sizes vary widely), plans booked, extra nights and estimated new spend, per conference and in total. The count feeds the money formula; the % makes conferences of different sizes comparable.
   - Split by type of spend (extra nights, short activities, specialist) and by area (Sapporo, Otaru, Jozankei…).
   - **All numbers are simulated and clearly labelled as such.** The formula behind them is shown on screen (see [04-long-term-plan.md](04-long-term-plan.md#money-model)).

## Demo conferences

Use **one big upcoming domestic event and one big upcoming international event**. Using two shows that the system works on any conference, not one we hard-coded. **Chosen (D7): JADM32 (domestic) and ICEP2027 (international).** Pick events whose program is already published online. Candidates:

| Event | Dates | Where | Type |
|---|---|---|---|
| 32nd Japanese Association for Disaster Medicine | Mar 17–20 2027 (Wed–Sat) | Sapporo Convention Center | Domestic |
| 131st Japanese Ophthalmological Society | Apr 15–18 2027 (Thu–Sun) | Hotels and halls, central Sapporo | Domestic, large |
| 113th Japanese Society of Gastroenterology | May 6–8 2027 (Thu–Sat) | Keio Plaza, Grand Mercure Sapporo | Domestic, large |
| ICEP 2027 (electronics packaging) | May 12–15 2027 | Grand Mercure Sapporo | International, 1,200+ expected |
| ICCDU 2027 (CO2 utilization) | Jun 28–Jul 2 2027 | Hokkaido University | International, published free afternoon |
| ISCNP33 / ICOB13 (natural products) | Aug 29–Sep 2 2027 | Sapporo Convention Center | International, detailed program |

Dates come from the organizers' or the city's pages (Reported, [S25] and [S1] in [06-sources.md](06-sources.md)). Check them again before using them.

## Activity and venue list

The list of real activities, restaurants and extra-night plans is built **separately** by an AI agent using [prompts/inventory-research.md](prompts/inventory-research.md), and checked by a person. The demo reads that list. It never makes up places or prices on screen.

## Build

| Part | Must have | Nice to have |
|---|---|---|
| Conference reading | URL or PDF → dates, venues, sessions, free windows (structured data) | Guess the audience's field and interests from the program |
| Matching | Plans that fit each window: duration, distance from the venue, opening hours, price | Ranking by attendee interests |
| Organizer view | Approve/remove plans; generate link, QR code, email text (JA/EN) | Edit the email text |
| Attendee view | One timeline (sessions + free time), plans, join others, mock checkout (JA/EN) | Share a plan with colleagues |
| City view | Simulated numbers with labels, formula visible | Sliders to change the assumptions |
| Event log | Every interaction (plan shown, opened, joined, booked, removed by organizer) saved as a row, from the first click. The city view reads from it | – |

## Do not build

Real payments, live availability, real bookings with providers, attendee accounts beyond a simple name, merchant self-service portal, native mobile app, languages other than Japanese and English.

## Tech choices

Use hackathon partners only where they genuinely fit. Each piece of intelligence has one job:

| Job | Tool | Why this tool |
|---|---|---|
| **Filter what is possible:** which plans fit this time window, near this venue, open at this hour; who else from this conference joined | **Neo4j** (graph database). Use it | The data is naturally a graph (below). Neo4j also offers a special prize for the best use case |
| **Read and write words:** turn a messy conference site or PDF into a clean schedule; write plan descriptions, email text and specialist-visit ideas in Japanese and English | **An LLM, called through OrcaRouter** [S26] | One OpenAI-compatible endpoint for many models. Send hard extraction to a strong model and routine cleanup or translation to a cheap one. Automatic failover keeps the live demo running if one provider is slow |
| **Make choices:** is this session block free time? Does this plan suit this audience? Which 3 plans should we show first? | **TypeSafe's Jev** (decision model) [S27] | Returns a structured answer with a probability instead of free text. Low-confidence answers go to the organizer to approve, and the confidence can show on screen. It is in early access, so **confirm access on day 1**. If it isn't available, use the LLM with structured output instead |
| Store the event log and mock orders | **Neon** (serverless Postgres). Recommended | An append-only log is a plain table. Keeping it out of the graph keeps both simple |
| Look up missing details on the web (venue address, hotel list) | **Linkup** (web search API). Optional | Only if conference pages leave gaps |

**In short:** the graph decides what is *possible*, the decision model decides what is *best*, and the LLM writes the *words*.

Example graph: Conference → has → Time window; Plan → located at → Place → in → Area; Plan → fits → Time window; Attendee → attends → Conference; Attendee → joined → Plan; Conference topic → relates to → Specialist plan.

Not needed for the core scope: Hyper3D, Cascadeur, Dify, Hermes Agent, Adaption Labs. ElevenLabs, Fish Audio and PixVerse only for the stretch goal below.

## Stretch goal: short preview videos

Only after every "Must have" above works.

**What:** each plan, especially extra-night plans, gets a 15–30 second preview: a few real photos with gentle motion, short captions and a voiceover in Japanese or English ("Finish your conference on Saturday, and by 6 pm you're in an open-air onsen in Jozankei…").

**Why it's worth it:** the decision to stay an extra night is emotional and is made when booking flights. A short video in the pre-arrival email persuades far better than text. It also demos well.

**Tools:** **ElevenLabs** (or **Fish Audio**, which is strong in Japanese; pick one) for the voiceover, and **PixVerse** to add motion to still photos.

**Rules:**
- Use real photos of the real place, with permission (from the operator or a source that allows reuse). Never generate footage that makes a place look different from reality.
- Label anything AI-generated.
- Pre-generate videos for the demo events. Don't generate them live on stage.

## Stretch goal: "attendees like you picked…"

Shows the data flywheel ([04-long-term-plan.md](04-long-term-plan.md#data-flywheel)): the product gets better with every conference.

- Start with plain counts, no ML: "Attendees at your conference signed up for…" and "Attendees in Sapporo this week signed up for…". Seeing who is joining sparks more joins.
- Seed the event log with the two demo conferences' **simulated** data ([07-data-plan.md](07-data-plan.md)), clearly labelled as such. "Similar conferences" needs more simulated conferences, so do it only if time allows.
- In Neo4j, link each conference to similar past ones (field, size, season, end day).
- In the attendee view, show "Popular with attendees at similar conferences". In the organizer view, show which suggestions were skipped at similar events.
- This is also the strongest Neo4j use case for the special prize.

## Rules for agents building this

- The repository will be **open source**. No secrets in code, and every data item records its source. Copyrighted photos are allowed during the hackathon (D21); record each photo's source page and replace them before any public launch.
- Never present simulated or estimated numbers as real. Label them on screen.
- Log every interaction to the event log, including plans that were shown but not picked. No names or emails in the log.
- Never invent places, prices or opening hours. If the list doesn't have it, don't show it.
- Japanese is the primary language. English must be complete, not partial.
- Design for any conference. Nothing may be hard-coded to the demo events.

## How the judges will score us, and our answer

| Judging point | Our answer |
|---|---|
| How important the problem is | Sapporo can't host more conferences until about FY2033, so spend per visitor is the only way to grow. The city already pays for this by hand ([01-evidence.md](01-evidence.md)). |
| Demo quality | Live: paste a conference link the system hasn't seen, and get a working page. |
| Implementation | Clean, open-source repo; the conference reading works on real, messy sites. |
| Usefulness to Hokkaido | New money for local businesses, extra nights in Hokkaido, and measured results the city can use. |
| Partner use | Neo4j, OrcaRouter and TypeSafe's Jev each doing the job they are best at. ElevenLabs/Fish Audio and PixVerse if we reach the stretch goal. |
