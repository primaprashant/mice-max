# Project guidelines

Apply these guidelines in every agent session.

- **Keep it simple.** This is a small project with zero users and no one depending on it. Build the simplest solution for the current scope. Avoid enterprise architecture, speculative abstractions, complicated setup, and exhaustive edge-case handling. Accept minor edge-case gaps when they meaningfully simplify the code or design.
- **Delegate when useful.** Use sub-agents for suitable, separable work, especially research, web searches, and builds or checks with noisy output. Ask for concise findings and relevant file references so the main agent preserves context for larger tasks. Skip delegation when coordination would cost more than it saves.
- **Ask for human decisions.** Use the available question tool when meaningful trade-offs, preferences, or unclear scope need human input. Ask as often as needed, in small batches, including during implementation. Resolve routine details independently; do not invent unnecessary decisions for the user.
- **Be concise.** Keep responses, docs, comments, specs, plans, plan updates, and verification notes short, direct, and free of jargon. Include only what helps someone understand, decide, implement, or verify. Avoid repetition and unnecessary documents.
- **Design with intent.** Never join UI items with separator characters (`·`, `•`, `—`, `|`); they read as careless, generated design. Use layout instead: alignment, spacing, columns or separate lines. Never mark status (failed, partial, ok) with colored dots or similar markers.
- **Make the project easy for agents to navigate.** Use clear names, logical grouping, and reasonably short files and functions. Follow progressive disclosure: keep entry-point docs brief and link to focused details that agents can read when needed. Make relevant code and documentation easy to find without loading everything into context.

# Project overview

MiceMax helps people visiting Hokkaido for business events (MICE) spend more locally: it reads a conference's website, finds attendees' free time and offers experiences that fit (extra night first, then short activities, then specialist visits). Built for a 2-day hackathon in Sapporo. Organizer, attendee and city views share one conference link.

`README.md` (and `README.ja.md`) is written for hackathon judges, not developers. Keep developer details here. When you change one README, change the other to match.

## Files

- `README.md`, `README.ja.md`: the pitch for judges, English and Japanese.

- `docs/README.md`: entry point, five-line summary, glossary, reading order.
- `docs/03-hackathon-scope.md`: what to build and not build, tech choices, and "Rules for agents building this". Read before writing code.
- `docs/05-decisions-and-open-questions.md`: decisions (D1, D2, ...) and open questions (Q1, Q2, ...). Update it when a decision changes.
- `docs/07-data-plan.md`: data the demo needs (real, written, simulated), where it is stored (SQLite master copy) and tasks T0–T9 to build it.
- `docs/08-outreach-plan.md`: real outreach during the hackathon (interviews, businesses, organizers, city) and how it shows in the demo.
- `docs/10-ai-operations-plan.md`: the AI operations layer for the final demo (live pipeline, agents, Ops view), work streams and order. Read before building it.
- `docs/11-ops-company-page-plan.md`: the `/ops` company showcase (3D agent network) and its files.
- `docs/01-evidence.md`, `02-vision.md`, `04-long-term-plan.md`, `06-sources.md`: background, vision, business plan, sources [S1]...
- `docs/charts/`: chart PNGs and `make_charts.py` that draws them.
- `docs/prompts/inventory-research.md`: prompt for building the activity and venue list.
- `ui/README.md`: UI stack, structure and screen details.

## Apps

- `backend/`: FastAPI. Reads `data/micemax.db` (committed SQLite) for catalog data. Live AI features live in `backend/app/ai/`, one module per feature, each recording a step through `steplog.record`. Writes the event log to Neon only when `DATABASE_URL` is set; otherwise those writes return 503 and the demo still works.
- `ui/`: Astro frontend. Every screen works from the same SQLite file.
- `data/`: the SQLite master copy, its build scripts (`data/scripts/`) and source data.

Deployed: frontend https://mice-max.netlify.app (Netlify), backend on Render (`backend/render.yaml`).

## Run locally

Needs Python 3.12+ with uv, and Node 22+.

```sh
cd backend && uv sync && .venv/bin/uvicorn app.main:app --port 8787   # check /health
cd ui && npm install && npm run dev                                    # http://localhost:4321
```

`/` redirects to `/home` (login is at `/login`, role tab, any name); `/nav` links every screen. Main screens: `/c/:conf` attendee, `/organize/:conf` organizer, `/city` city, `/ops` company showcase (3D agent network), `/ops/run` live ingest, `/ops/sales` sales agent, `/ops/:conf` disruption and voice booking.

## Environment variables (backend)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres; unset means event-log writes return 503 |
| `CORS_ORIGINS` | Comma-separated allowed origins; unset means same-origin only; `*` for local cross-origin |
| `MICEMAX_DB` | Override the SQLite path (default `data/micemax.db`) |
| `ORCAROUTER_KEY` | LLM calls through OrcaRouter |
| `LINKUP_API_KEY` | Web search in ingest step 1 |
| `NEO4J_*` | Neo4j Aura for the disruption agent (falls back to SQLite) |
| `ELEVEN_KEY` | ElevenLabs, for the voice agent and call audio |
