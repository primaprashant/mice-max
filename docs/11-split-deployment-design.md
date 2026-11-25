# MiceMax: split deployment design

The demo now deploys as two services. A FastAPI backend holds every secret and owns
the databases. A pure-static Astro UI calls it over HTTP. This replaces the single
Netlify SSR deploy in [10-deployment-plan.md](10-deployment-plan.md).

## Why this split

- Secrets: the repo is public, so Neon, Neo4j Aura and OrcaRouter credentials can
  never ship in frontend code. One backend holds them all.
- Direct database access: the backend calls Neon and Neo4j directly, so the UI
  stops being the place where data code lives.
- Static frontend: with secrets gone, the Astro adapter goes away. Every page
  builds to HTML and assets, deployed free on Netlify. No SSR functions.

## Three perspectives

Frontend: every screen keeps its look. Data arrives as JSON from the backend
instead of function calls. The pages that showed per-attendee state from cookies
(calendar, experience page) switch to reading browser storage through the client
scripts, which already hold the attendee's plans.

Backend: one FastAPI app in `backend/`. It reads the committed `data/micemax.db`
(read-only) for catalog data, Neon for anything that must persist, and Neo4j for
matching. Endpoints are grouped by view.

Security: parameterized queries only. CORS restricted to the frontend origin. No
secret in the repo. The attendee cookie is demo-grade on purpose (the docs say the
password is never checked); the backend does not check it either.

## Architecture

```
Browser ── HTTP ──> FastAPI backend ──> SQLite (read-only catalog)
                          ├──> Neon (bookings, event log, persists)
                          └──> Neo4j (matching, later)
Netlify CDN ──> static Astro build (calls the backend at API_BASE)
```

## Endpoints

| Method | Path | Purpose | Store |
|---|---|---|---|
| GET | /health | liveness | – |
| GET | /api/conferences | demo conference list | SQLite |
| GET | /api/conferences/{id}/sessions | calendar sessions | SQLite |
| GET | /api/conferences/{id}/windows | free-time windows | SQLite |
| GET | /api/conferences/{id}/experiences | cards | SQLite |
| GET | /api/experiences/{id} | one experience: copy, photos, stops, tags, travel | SQLite |
| GET | /api/experiences/{id}/attendees | who joined (circular icons) | SQLite |
| GET | /api/experiences/{id}/counts | join counts per conference | SQLite |
| GET | /api/experiences/{id}/travel | travel time from the conference venue | SQLite |
| GET | /api/headlines/{conference} | the 8 demo experiences | SQLite |
| GET | /api/city | city view aggregates | SQLite |
| GET | /api/attendees/{id} | one attendee (name for header) | SQLite |
| POST | /api/events | append one event-log row (shown, opened, joined, booked) | Neon |
| GET | /api/organize/{id} | organizer data: windows with fit + stats | SQLite |

The organizer's conference-reading LLM call is out of scope for this build; the
demo opens stored programs (the scope doc's "emulate read" path).

## Data stores

SQLite master copy `data/micemax.db`, read-only: catalog (conferences, sessions,
windows, experiences and their copy, photos, stops, tags, travel, attendees,
city estimates, seasons, city events, simulation scales). It ships with the
backend and is also the offline dev source.

Neon: the `events` log table for writes that must survive (booked, joined,
removed_by_organizer) and any real attendee rows. Table shapes already exist in
[data/scripts/schema.sql](../data/scripts/schema.sql). Reads for the city view
still come from SQLite in this build; a follow-up swaps them to Neon so real
bookings count.

Neo4j Aura: not called in this build. The graph holds the same FITS edges the
simulator computed; the UI's fit logic runs server-side from SQLite. Wiring Aura
in is a follow-up, not a demo blocker.

## Frontend changes

1. Remove the Node adapter; build fully static. The one `api/*.ts` endpoint
   (`api/login.ts`) and `export const prerender = false` lines go away.
2. Pages fetch JSON in the frontmatter from `API_BASE` (build-time env), or a
   small client island loads it. Static + fetch keeps the screens unchanged.
3. Attendee state stays in the browser: `plan-store.ts` (localStorage) and the
   language cookie already work without a server.
4. The login POST becomes a client call that sets the attendee cookie client-side
   and appends a `reached` event through the backend.

## Deployment

- Backend: Render web service, Python 3.12, start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Free tier sleeps after
  15 idle minutes; open the URL a minute before the demo, or pay to keep it awake.
- Frontend: Netlify, static. Build command `npm run build`, publish `dist`.
- The frontend needs the backend URL at build time, and the backend needs the
  frontend origin for CORS. Deploy the backend first, then the frontend, then set
  CORS on the backend and rebuild the frontend once.

## What stays out

Real payments, real LLM conference reading, attendee accounts, the Neo4j call,
mobile. The mock checkout stays mock. All city numbers stay simulated and labeled.
