# Deployment checklist

Where we deploy and what we need before starting. The backend goes on Render, the frontend on Netlify. Both deploy from the GitHub repo `primaprashant/mice-max`. The split work continues on the `ui-skeleton` branch. The `main` branch holds the merged PR #4.

Status 2026-11-26: the repo owner handles the Render deploy because this machine cannot connect Render to the repo. This file carries the full instructions for them in "Render walkthrough for the repo owner". The Netlify step and the Neon step stay open.

## Target

| Piece | Service | Config | Needs |
| --- | --- | --- | --- |
| Backend API | Render web service | [backend/render.yaml](../backend/render.yaml) | `DATABASE_URL`, `CORS_ORIGINS` (set in the Render dashboard) |
| Frontend | Netlify site | [10-deployment-plan.md](10-deployment-plan.md), step 1 | Base dir `ui`, build `npm ci && npm run build`, publish `ui/dist`, `NODE_VERSION=22` |
| Data (event log) | Neon Postgres | [data/scripts/push_neon.py](../data/scripts/push_neon.py) | Pooled connection string, kept out of the repo |
| Catalog data | Committed `data/micemax.db` | Already in the repo | Nothing |

Deploy order: backend first, then frontend. The frontend needs the backend URL to call. The backend needs the frontend origin for CORS. Set `CORS_ORIGINS` after both URLs exist, then redeploy the backend once.

## Already in place (verified 2026-11-26)

- The repo is `primaprashant/mice-max`; the merged PR #4 put the backend, the README and the fixed endpoints on `main`. GitHub auth works from this machine as `kaustubhhiware`.
- [backend/render.yaml](../backend/render.yaml) defines the Render service: Python 3.12, `uv sync`, uvicorn on `$PORT`, `sync: false` for both secrets.
- The frontend builds with no changes: `npm run build` passes, `astro check` passes, and the SSR bundle carries `data/micemax.db` (`includeFiles` in [ui/astro.config.mjs](../ui/astro.config.mjs)).
- All 13 backend GET endpoints return 200 against the committed SQLite copy; `POST /api/events` returns 503 without `DATABASE_URL` (fail closed by design).

## Needed from a human before starting

- ~~A Render account~~ Done: the repo owner runs the Render deploy; the walkthrough below is for them.
- A Netlify account connected to GitHub, or a Netlify personal access token, so `netlify-cli` can create the site from this machine. No existing Netlify login state was found on this machine.
- A Netlify account connected to GitHub, or a Netlify personal access token, so `netlify-cli` can create the site from this machine. No existing Netlify login state was found on this machine.
- A decision on the deploy source. Deploying from `primaprashant/mice-max` needs the repo owner to authorize the Render and Netlify apps. If that is not possible, fork the repo under `kaustubhhiware` and deploy the fork.
- For the Neon step: the Neon project and its pooled connection string, plus a yes or no on running `push_neon.py` (it wipes and reloads the Neon tables from the SQLite master copy).

## Step sequence when told to start

1. Render: create the web service from the repo, root dir `backend`, blueprint from [backend/render.yaml](../backend/render.yaml). Leave `DATABASE_URL` empty (writes fail closed) and `CORS_ORIGINS` as `*` for the first deploy. Save the service URL.
2. Netlify: import the repo, apply the build settings from the table above, set `NODE_VERSION=22`. Save the site URL.
3. Point `CORS_ORIGINS` on Render at the Netlify origin and redeploy the backend once.
4. Open the site URL and walk the demo order: attendee calendar, event page, mock checkout, organizer flow, city view (the order in [09-ui-plan.md](09-ui-plan.md)). Check the simulated labels.
5. Neon: put the pooled connection string in a root `.env` (never committed), run `push_neon.py` once if approved, then set `DATABASE_URL` on Render and redeploy. Event-log writes start to persist.

## Render walkthrough for the repo owner

Sign in at <https://dashboard.render.com> with GitHub, and authorize Render to read `primaprashant/mice-max`. Then:

1. Click **New +**, then **Blueprint**. Pick the repo, branch `main`. Render reads [backend/render.yaml](../backend/render.yaml) and shows the service `micemax-backend` it defines.
2. On the review page, fill the two env vars it marks **sync: false**:
   - `DATABASE_URL`: leave empty for the first deploy. Without it, event-log writes return 503 and everything else works.
   - `CORS_ORIGINS`: leave empty. Unset means same-origin only, which is correct until the Netlify site exists. Change it to the Netlify origin in step 3 below.
3. Click **Apply Services**. Render clones the repo, runs `pip install uv`, then `uv sync --no-dev`, then starts uvicorn on `$PORT`. The first deploy takes 2 to 4 minutes; the Events tab shows live logs.
4. Open the service page and copy the URL at the top (it looks like `https://micemax-backend-xxxx.onrender.com`). Send it to Kaustubh.

If Blueprint fails, use **New +** → **Web Service** with the same repo and branch, and set: Root Directory `backend`, Runtime Python 3, Build Command `pip install uv && uv sync --no-dev`, Start Command `.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT`, Instance Type Free. The env vars are the same as in step 2.

Checks after the first deploy (anyone with the URL can run these):

- `curl https://<the-url>/health` returns `{"status":"ok"}`.
- `curl https://<the-url>/api/conferences` returns two rows (`jadm32`, `icep2027`).
- `curl -X POST https://<the-url>/api/events -H "Content-Type: application/json" -d '{"conference_id":"jadm32","event_type":"page_visited"}'` returns 503. That is correct without `DATABASE_URL`; it becomes 204 after the Neon step.

Deploys after the first: Render auto-deploys on every push to `main`. Free tier sleeps after 15 idle minutes; the first request after a pause takes about 50 seconds to wake.

## Cautions

- The deployed site is public and the repo is public. `POST /api/events` accepts unauthenticated writes by design, so anyone who finds the backend URL can write rows into Neon. Step 3 above closes most of that door.
- Render's free tier sleeps after 15 idle minutes. Open the URL a minute before the demo, or pay to keep it awake.
- The `.env` at the repo root is ignored by [.gitignore](../.gitignore). Never commit it.
