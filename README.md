# MiceMax

A demo for a 2-day hackathon in Sapporo: reads a conference's website, finds attendees' free time and offers experiences that fit (an extra night first, then short activities, then specialist visits). Read [docs/README.md](docs/README.md) for the project briefs.

The repo has two apps:

- `backend/` — a FastAPI API. Reads `data/micemax.db` (a committed SQLite file) for catalog data; writes the event log to Neon only when `DATABASE_URL` is set. Without it, event writes fail closed with a 503 and the demo still works.
- `ui/` — the Astro frontend. Static pages plus small client scripts; every screen works offline from the same SQLite file.

## Run both

You need Python 3.12+ with [uv](https://docs.astral.sh/uv/) and Node 22+.

Backend:

```sh
cd backend
uv sync
.venv/bin/uvicorn app.main:app --port 8787
```

Check `http://localhost:8787/health` returns `{"status":"ok"}`.

Frontend, in a second terminal:

```sh
cd ui
npm install
npm run dev
```

Open the printed URL (default `http://localhost:4321`).

## Environment variables

| Variable | App | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | backend | no | Neon Postgres connection string; unset means event-log writes return 503 |
| `CORS_ORIGINS` | backend | no | Comma-separated allowed origins, default `*` |
| `MICEMAX_DB` | backend | no | Override the SQLite path (default: `data/micemax.db` in the repo root) |

## Layout

| Path | What it is |
|---|---|
| `docs/` | Project briefs; start at [docs/README.md](docs/README.md) |
| `data/` | The SQLite master copy, its import scripts and source data |
| `backend/` | The FastAPI app |
| `ui/` | The Astro app; [ui/README.md](ui/README.md) has screen details |
