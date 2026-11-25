# MiceMax: AI operations plan (last hours of the hackathon)

What we add so the demo shows a company run by AI agents, not another experience site. Builds on [03-hackathon-scope.md](03-hackathon-scope.md), [07-data-plan.md](07-data-plan.md) and the UI plan (`docs/09-ui-plan.md` on `ui-skeleton`). Decisions D30–D38 in [05-decisions-and-open-questions.md](05-decisions-and-open-questions.md).

## Why

- Experience cards alone look like Airbnb Experiences or a ChatGPT answer. Removing friction isn't a reason for the city to fund us.
- The city already pays for the goal: ¥3.99M (Doshin EC, June 2026) for a "+1 night" program for **one** conference, run by hand [S3]. Sapporo holds about 466 a year [S1].
- **Our pitch to the city government:** manual contracts cover one conference at a time. MiceMax runs the whole operation with AI agents and very few people, so the same budget covers every conference, then other cities.

## Minimal version (build first)

Get the Ops page working as soon as possible with **pre-recorded output for everything**. There are no live AI calls on the site, so there is no backend: the UI reads Neon with a read-only role. Every row is labelled **Replay**, and rows built on simulated attendees are also labelled simulated.

### The Ops page follows the conference's life

Pasting the URL only sets the conference up. Bookings, calls and reminders happen weeks later, after people register. So the Ops page is a timeline in four phases, using the event log's real dates (JADM32: Dec 2026 to Mar 2027).

| Phase | When | What the agents did | Recorded from |
|---|---|---|---|
| Setup | Organizer pastes the URL | Steps 1–9: read the site, schedule, sessions sorted, free windows, audience, graph filter (with what it ruled out and why), experiences, JA/EN page and email | Existing data: agents built these sessions, windows, experiences and copy (T3–T6) |
| Before | Registration to arrival | Emails sent, groups filling and nudged, **booking call** to the restaurant, reminders | Simulated `events`, plus one call script and audio |
| During | Conference days | Attendee and organizer questions answered (one handed to a person), **snow disruption** replanned, hosts assigned | Written samples, plus a real graph query on simulated attendees |
| After | Day after close | Results flow into the city view | Link to the city view |

### Step log

One table, `agent_steps`, in `schema.sql`. `push_neon.py` copies it to Neon automatically. The full version adds live rows to the same table.

`id, conference_id, phase (setup/before/during/after), ts, step (1–12 from the brief), agent, title_ja, title_en, tool (llm/jev/graph/voice/video/search), model, mode (live/replay), ms, tokens_in, tokens_out, confidence, handed_to_human, summary_ja, summary_en, output (JSON), artifact (file path, e.g. call audio), simulated`

Replay rows leave `ms`, tokens and `confidence` empty unless they were really measured. Don't invent them.

### Tasks (no UI needed, start now)

Generic per conference; both demo conferences get M2 and M3. M4–M6 cover JADM32 first, then ICEP2027 if time allows.

| # | Task | Output | Time |
|---|---|---|---|
| M1 | Add `agent_steps` to `schema.sql`; `record_ops.py` runs in `build_db.py` after `simulate.py` | Table | 15 min |
| M2 | **Setup rows** from existing data: counts and samples per step (e.g. "210 sessions, 15 windows"). Step 6 lists experiences the fit rules ruled out per window, with the reason (closed that month, too long, misses the last bus). A copy of `simulate.fits` that returns the reason | ~10 rows per conference | 45 min |
| M3 | **Before and during rows** from simulated `events`: daily email waves, groups reaching their size and nudges, reminders the day before each booking, host per group | ~30 rows per conference | 45 min |
| M4 | **Booking call:** an LLM writes a Japanese call script (agent and restaurant, with an English translation) for the JADM32 evening headline, using real hours, price and the simulated party size. ElevenLabs TTS reads it in two voices into one audio file. Label: simulated call | `data/raw/ops/<conf>/call.json`, `data/media/calls/<conf>.mp3` | 45 min |
| M5 | **Q&A samples:** 5 attendee and 3 organizer questions with answers written from our data; one is handed to a person | `data/raw/ops/<conf>/qa.json` | 30 min |
| M6 | **Snow disruption:** a simulated alert (Jozankei bus suspended on the extra night). Affected attendees found with a real query on simulated joins; alternatives from the same window's fits; JA/EN messages written by an LLM | `data/raw/ops/<conf>/disruption.json` | 45 min |
| M7 | Rebuild, `push_neon.py`, check that every row has a mode and a simulated flag | Neon | 15 min |

LLM text in M4–M6 is generated once by a script (OrcaRouter) and saved in `data/raw/ops/`, so rebuilds stay the same.

### UI (teammate)

The Ops page: the four-phase timeline of step cards, a player and transcript for the call, the disruption card with its messages, the Q&A samples. Small badges in the other views link to their step.

### Then expand

Add from the full version below in this order: a live pipeline on the tested list, live Q&A chat, live disruption, a real voice agent, preview videos.

## Full version (add when time allows)

### What judges must see

1. **It reads a conference it hasn't seen**, live: URL → schedule → free time → experiences checked against the graph → JA/EN page and email.
2. **AI runs the operations:** it calls a business to book (voice), answers attendee and organizer questions (chat) and replans when snow stops the bus.
3. **One control room (Ops view)** where every agent step shows up with its model, time, confidence and a **Live** or **Replay** label.
4. **Guardrails:** the AI proposes and the graph checks. Rejected ideas show with the reason, e.g. "closed in March" or "misses last bus 17:30".

### Live and Replay

| Part | Mode | Notes |
|---|---|---|
| Pipeline steps 1–9 | Live | Only on a tested list: ISCNP33, ICCDU2027, JOS131, plus JADM32 and ICEP2027. The last good run is kept, so a page opens at once and covers a failed run on stage |
| Q&A chat (attendee and organizer) | Live | Answers from this conference's data only; unsure answers say "passed to a person" |
| Disruption replanning | Live, simulated alert | Only the alert is fake, and it is labelled |
| Booking call | Replay, plus judges try it | One recorded call; judges can play the restaurant owner in the browser |
| Reminders, filling groups, assigning hosts | Replay | Generated from the simulated event log |
| Preview videos | Made ahead of time | Labelled AI-generated |

Out for now: city report writer (step 11), learning loop (step 12), human approval queue, AI photo checks, Hyper3D, real scheduled jobs. The pitch mentions them as next steps.

### Step log

Same `agent_steps` table as the minimal version; live steps add rows with `mode = live`, timings, tokens and Jev confidence.

### Work streams

Hours are rough. A–D run in parallel; E starts once A and B have something to record.

#### A. Live pipeline (backend, ~4 h)

One server route per step, called in turn by the browser, so no request runs long. Keys stay on the server (Astro plus Railway, details later). Each step writes an `agent_steps` row.

| Step | What | Tool |
|---|---|---|
| 1 Read | Fetch the URL or PDF; fill gaps (venue, dates) | Fetch, Linkup |
| 2 Schedule | Sessions in the same shape as `data/raw/programs/*/sessions.csv` | Strong LLM |
| 3 Sort sessions | Must-attend or skippable, with confidence | Jev |
| 4 Free time | Windows in the same shape as `windows.csv`; Jev checks if each is really free | Rules, Jev |
| 5 Audience | Field → interests and tags | Cheap LLM |
| 6 Filter | Experiences that fit each window: duration, opening hours, travel, season, last train | Neo4j (Cypher with window parameters) |
| 7 Build | LLM suggests combos and specialist visits; the graph rejects anything not in our data, and rejects show with reasons | LLM, Neo4j |
| 8 Rank | Top 3 per window; low confidence is flagged on the organizer's approve list | Jev |
| 9 Write | Page intro, email and window names in JA and EN, QR code | Cheap LLM |

The hand-checked JADM32 and ICEP2027 rows are the test answers for steps 2 and 4.

#### B. Operations agents (~4 h)

- **Booking call (ElevenLabs Conversational AI, Japanese).** An agent prompt with the booking brief (experience, date, time, party size, budget, allergies) for the JADM32 evening headline (Mt Moiwa night view and miso ramen). Record one real call with a teammate playing the restaurant, and save the audio, the transcript and the booking it produced. Put the same agent on the site as a browser widget (public agent ID, no secret key).
- **Q&A chat.** One server route, used in two modes. Attendee mode gets the conference's sessions, windows, experiences and "good to know" text. Organizer mode adds uptake counts from `events`. Jev decides whether to answer or hand off, and each reply is a step row.
- **Disruption.** A button fires the simulated alert "Jozankei bus suspended, heavy snow, Sat Mar 20". The agent finds affected attendees in the graph (`Attendee-JOINED->Experience-HAS_STOP->Plan-AT->Place-IN_AREA->{jozankei}`) and alternatives in the same window outside that area. Jev picks one per group, and the LLM writes JA/EN messages. A Replay step shows the "call the ryokan to move the booking" part.
- **Replay seed.** A script turns the simulated `events` into replay rows: reminders sent, nudges for groups still filling ("8 of 10 joined"), hosts assigned.

#### C. UI (~4 h, with the UI teammate)

- **Ops view, the 4th view:** a pipeline panel (steps 1–9 with status, model, time and confidence; click to see the output and the rejected ideas); an activity feed across conferences; a calls panel (audio player, transcript, result); the disruption button; and a small "built by agents" panel (269 conferences, 96 plans, 198 photos, JA/EN copy and the graph in about a day).
- **Badges in the other views**, linked to their step: "Read from the website by AI in 2 min", "Written by AI, Japanese checked by a person", "Booked by AI call". Each shows Live or Replay.
- A chat panel in the attendee and organizer views.
- A conference picker for the tested list, and a progress screen while the pipeline runs.

#### D. Data and media (~3 h)

- **Tested conferences:** confirm each one's program fetches cleanly. Geocode the ICCDU2027 venue (`venue-00a8858b`) and run `compute_travel.py` for the new venues.
- Booking brief and a one-page role sheet for the teammate playing the restaurant. Call audio and transcript in `data/media/calls/`.
- **Preview videos** for the 4 headline extra nights and evenings: real photos → video model for gentle motion → ElevenLabs voiceover JA and EN → join with ffmpeg. Save in `data/media/videos/`. If time runs short, make 2.

#### E. Pitch, video and deploy (~2 h)

- **3-minute pitch:** problem and the ¥3.99M-for-one-conference contract (30 s); live run on an unseen conference with rejected ideas visible (60 s); Ops view: call clip, disruption button (60 s); cost per conference estimate and "every conference, then every city" (30 s).
- **3-minute video:** a fuller version of the above, including the booking call audio and a preview video.
- **Cost slide:** a worked estimate of AI cost and human minutes per conference compared with ¥3.99M per conference, labelled as an estimate.
- **Deployed site:** a demo index page that links every screen in demo order.

### Order of work

1. **First 30 min:** agree the step route shape with the UI teammate; record the restaurant role sheet; start the video jobs (they run in the background).
2. **Hours 1–4:** A (steps 1, 2, 4, 6 first, then 3, 5, 7, 8, 9), B (call recording, chat), C (Ops view on replay rows), D (tested conferences).
3. **Hours 4–6:** disruption; badges; wire the live pipeline into the Ops view; rejected ideas on screen.
4. **Hours 6–8:** deploy; run every tested conference end to end; fix; record the video; rehearse the pitch.

If time runs short, cut in this order: preview videos to 2, then disruption to Replay, then steps 3 and 8 on the LLM instead of Jev.
