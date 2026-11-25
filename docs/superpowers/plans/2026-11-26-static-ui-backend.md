# Static UI + backend split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ui/` build fully static (no server), with all data served by the FastAPI backend in `backend/` at runtime through client-side fetch islands, per [11-split-deployment-design.md](../../11-split-deployment-design.md) and the user's choice of runtime-fetch architecture.

**Architecture:** Nine Astro pages become thin static shells; per-page client islands fetch JSON from `API_BASE` (an env var read at build time in `ui/src/scripts/api.ts`), render content, and read the `lang` cookie themselves. The backend gains the read endpoints the pages need, each proven against the committed `data/micemax.db` with pytest. Attendee plans stay in localStorage (`plan-store.ts`); the event log keeps POSTing to the backend.

**Tech Stack:** Astro 7 static output, TypeScript islands (custom elements, no framework), Tailwind 4, FastAPI + sqlite3 (read-only) + psycopg (Neon writes), pytest + httpx.

**Spec:** [docs/11-split-deployment-design.md](../../11-split-deployment-design.md) — the endpoint table is the binding contract; the frontend-changes list (§Frontend changes) is this plan's task source. Project rules in [docs/03-hackathon-scope.md](../../03-hackathon-scope.md) §"Rules for agents building this" (no hardcoded demo strings, JA/EN complete, simulated labels). UI decisions in [docs/09-ui-plan.md](../../09-ui-plan.md).

## Global Constraints

- Every displayed string comes from `src/i18n` via `t(lang, key)`; no hardcoded user-facing strings in TS or Astro. The i18n module throws on a missing key, so a missing key fails visibly. JA must be complete (EN complete too).
- Backend SQL is parameterized only; SQLite is opened read-only (`mode=ro`).
- No secrets in the repo. The backend reads `DATABASE_URL` and `CORS_ORIGINS` from env; the UI reads `PUBLIC_API_BASE`.
- Simulated numbers carry the simulated label (`SimulatedLabel` or equivalent) wherever they show.
- `data/micemax.db` is the single offline dev source; the backend and tests read it read-only.
- Branch `ui-skeleton`; never commit to `main`. `uv` for all Python work, never pip directly.
- Photos: `ui/public/images/` already mirrors `data/images/` (verified: 91/91 dirs). Keep it that way; a follow-up copies at build time.
- The two demo conferences are `jadm32` and `icep2027` (D7). All cities/venues stay out of the UI code.

## Review Focus

The spec implies these inputs but no task's tests fully exercise them; the reviewer checks each deliberately:

1. **Backend asleep at demo time.** Render's free tier sleeps after 15 idle min. A person opening the site expects every screen to say so in words (e.g. a retry line), not a blank page or a thrown error. Pinned in Task 2 (island error state) and Task 11 (all pages).
2. **Unknown conference or experience id in the URL** (`/c/nonsense`, `/c/jadm32/e/nonsense`, `/organize/nonsense`). Expect: not-found text and a link home, in both languages, never a blank screen or a stack trace. Pinned in Tasks 3–5, 8.
3. **Neon unreachable or unset when POST /api/events is called.** The backend must still answer 503 (not 500), and the UI must ignore it (logging is best-effort). Pinned in Task 10.
4. **Language cookie missing** (first visit, or cookie cleared). Expect English default everywhere, `<html lang="en">`, and no JS error. Pinned in Task 1.
5. **Slow or large API responses on first paint.** Each screen shows its loading state (skeleton or line of text) before data arrives; the calendar must not render empty and then jump. Pinned in Tasks 2–9 as each page gains its island.

---

## Background the implementer needs

### What exists (branch state)

- `ui/` is a working Astro 7 SSR app (Netlify adapter). Nine screens render server-side, reading `data/micemax.db` through `ui/src/data/index.ts` (functions listed below). Type check `npx astro check` passes; `npm run build` passes.
- `backend/app/main.py` (345 lines) already exists with GET endpoints: `/health`, `/api/conferences`, `/api/conferences/{cid}/sessions`, `/api/conferences/{cid}/windows`, `/api/conferences/{cid}/experiences`, `/api/experiences/{eid}`, `/api/experiences/{eid}/attendees`, `/api/experiences/{eid}/counts`, `/api/experiences/{eid}/travel`, `/api/headlines/{cid}`, `/api/attendees/{aid}`, `/api/city`, `/api/organize/{cid}`, and POST `/api/events`. **It has a broken SQL join in `experiences()` (`w.venue_place_id` does not exist) and one bug in `append_event`** — Task 1 fixes both. `backend/tests/` does not exist yet.
- `ui/src/scripts/` already has the client islands: `plan-store.ts` (localStorage plans), `book-button.ts`, `my-plans.ts`, `first-visit-banner.ts`, `organizer-approve.ts`, `event-log.ts` (POSTs to `PUBLIC_API_BASE`).
- `ui/src/components/` has `Header.astro`, `PlanCard.astro`, `WindowRow.astro`, `SimulatedLabel.astro`. `WindowRow` renders suggestions as an Astro template — it moves to a TS island renderer in this plan.
- Uncommitted working-tree changes exist in `ui/src/pages/index.astro`, `ui/src/pages/login.astro`, `ui/src/pages/api/login.ts`, `ui/src/data/attendee.ts`, `ui/src/i18n/*.json`, `ui/src/styles/global.css`, `docs/09-ui-plan.md` (login redesign, consent line dropped, new `home.*` i18n keys). These are deliberate; build on them.

### Data-module functions to port to the backend (from `ui/src/data/index.ts`)

`conferences()`, `conferenceById(id)`, `sessionsForConference(cid)`, `windowsForConference(cid)`, `experiencesForConference(cid)` (join through `experience_travel` on the conference's main venue), `experienceById(eid)`, `experienceCopy(eid, lang)`, `experiencePhotos(eid)`, `experienceStops(eid)`, `experienceTravel(eid, venuePlaceId)`, `experienceTags(eid)`, `headlines(cid)`, `attendeesJoined(eid, limit)`, `joinedCounts(cid)`, `attendeeById(aid)`, `cityEstimates()`, `seasonFor(month)`, `cityEventsBetween(from, to)`, `simulationScales()`, `committedSpend(cid)`, `reachByConference()`, `windowStats(cid)`.

### Key fixtures (verified against `data/micemax.db`; use these exact values in tests)

- Conferences: `jadm32` "32nd Annual Meeting of the Japanese Association for Disaster Medicine", 2027-03-17→2027-03-20 (4 days incl. pre-day), field `medicine`, field_detail `disaster medicine`, main venue `scc`. `icep2027` "2027 International Conference on Electronics Packaging (ICEP 2027)", 2027-05-12→2027-05-15, field `engineering`, main venue `grand-mercure-odori`. 210 sessions for jadm32 (all `moved_from_last`), 15 windows; icep2027: 71 sessions, 18 windows.
- Experiences: 109 total, 18 extra_night, 10 combos. Travel rows: 270 rows covering 90 experiences × 3 venues; extra nights have none (they leave the city). `spec-rapidus-chitose-iim-1` has no travel row at all.
- Headlines: 4 per conference, one per kind. jadm32 evening headline: `combo-moiwa-night-view-and-miso-ramen` in window `jadm32-w05` (2027-03-18 19:15–23:00).
- Copy: `short-donbe-nijo-market` JA title `丼兵衛 二条市場店`, price ¥3,480, 5 tags.
- Photos: `experience_photos` rows point at `data/images/<plan_id>/<n>.jpg` where `plan_id` may differ from `experience_id` (combos point at their stop's plan photos); the backend must return the raw path so the UI's existing `data/images/… → /images/…` rewrite keeps working.
- Events (simulated log): jadm32 8,623 rows / icep2027 7,114. `plan_shown` 9,884 total, `plan_joined` 348, `plan_booked` 160. Per-window stats for jadm32 cover all 15 windows. `short-donbe-nijo-market`: shown 276, joined 17, and 17 distinct attendees joined it. `combo-moiwa-night-view-and-miso-ramen`: 5 distinct attendees joined, 2 photos, 2 stops.
- Spend (city view): jadm32 committed rows 269 (evening 139/¥548,056, extra_night 18/¥531,894, short 100/¥140,910, specialist 12/¥0); both conferences total 508 rows. 21 rows have experiences with empty `area_id` → area falls back to "Other"/"その他" (the data module does this; the backend must too).
- Reach: jadm32 193/1000 reached, icep2027 162/1000. Scales: jadm32 3.0, icep2027 1.2.
- City estimates: 32 rows; sums early ¥3,344,300, middle ¥32,459,215, strong ¥167,545,052, attendees 109,311. Seasons: 12 rows; month 3 high 4.5 low −2.4. City events overlapping jadm32's dates: 2 (Sapporo Kokusai ski season 2026-27; Consadole vs Montedio Yamagata).
- Attendee: `jadm32-a0081` "Kaito Takada" (高田 海斗).

### Design decisions (rulings already taken; the implementer applies them)

- **Runtime fetch islands** (user's choice over build-time rendering): pages are static shells; TS islands fetch and render. The backend must serve everything the old data module did, so new endpoints are added: `/api/conferences/{cid}/view` (calendar bundle), `/api/experiences/{eid}/detail`, `/api/city/view`, `/api/organize/{cid}/view`, `/api/session` (moment line). Task 1 adds them.
- **Language:** the `lang` cookie is set client-side by the header toggle (already the case). Islands read it with `document.cookie` and re-render on toggle via a custom event; the server never sees cookies. `<html lang>` is set by a tiny inline script.
- **Rendering:** Astro templates stay for static chrome (page titles, layout). All data-driven markup moves into the island render functions, reusing the existing markup/class strings so the screens look unchanged.
- **`plan_kinds`:** the backend returns it; the UI's fit rule uses it when present, falling back to the existing hardcoded map (`KINDS_BY_WINDOW`). One icep2027 window (`icep2027-w18`) allows only specialists — the hardcoded map would wrongly allow shorts, so this actually matters.
- **The experiences-set definition:** `experiencesForConference` currently joins through `experience_travel` on the venue; the backend's broken join is replaced with exactly that semantic (fix in Task 1).
- **Checkout query params:** `checkout.astro` currently reads `?exp=` server-side. The static page becomes a shell; the island reads the query string client-side.

---

### Task 1: Backend endpoint tests + bug fixes (TDD on the existing app)

**Files:**
- Create: `backend/tests/conftest.py`, `backend/tests/test_catalog.py`, `backend/tests/test_events.py`, `backend/tests/test_views.py`
- Modify: `backend/app/main.py` (fix `experiences()` join, fix `append_event` 503 return; add the new view endpoints and `/api/session`)

**Interfaces:**
- Consumes: existing `backend/app/main.py` app object; `data/micemax.db` at the repo root.
- Produces (all under the FastAPI app, all GET unless noted; exact response shapes the frontend tasks consume):
  - `GET /api/conferences/{cid}/view` → `{ conference, sessions: [...], windows: [...], experiences: [...], headlines: [...] }` — everything the calendar and organizer pages need in one round trip. `experiences` uses the travel-join semantics (distinct experiences having a travel row from the conference's main venue), with `fields` parsed to an array. Windows carry `plan_kinds` parsed to an array of strings.
  - `GET /api/experiences/{eid}/detail` → `{ experience (fields parsed), copy: {ja, en}, photos, stops, tags, travel: [{venue_place_id, mode, minutes}] }`. `travel` carries every venue row (the calendar needs per-venue times; the page picks the main venue's row client-side).
  - `GET /api/city/view` → `{ estimates, scales, reach, spend, by_kind, by_area }` where `by_kind`/`by_area` are pre-aggregated from committed (`plan_joined`/`plan_booked`) rows with area fallback `{"area": "Other", "area_ja": "その他"}` when the experience's `area_id` is null or unknown.
  - `GET /api/organize/{cid}/view` → existing `/api/organize/{cid}` shape plus `experiences` (same list as view) and `window_stats` keyed by experience id: `{ shown, joined }` (per-experience across the conference, matching the old `windowStats()`).
  - `GET /api/session?month=3` → `{ season, city_events }` (all city events; the UI filters by conference dates client-side) for the moment line. Season lookup by month, empty `city_events` array allowed.
  - `GET /api/conferences/{cid}/counts` → `{experience_id: joined_count}` per experience for that conference (what `/api/experiences/{eid}/counts` did per-experience; the event page needs all at once).
- Fixes: `experiences()` join must be `WHERE et.venue_place_id IN (SELECT place_id FROM conference_venues WHERE conference_id = :cid)` — the current `w.venue_place_id` raises `sqlite3.OperationalError`. `append_event` on `RuntimeError` (no DATABASE_URL) must return a JSON 503 body (`{"detail": "event log unavailable"}`) instead of returning a bare 204-shaped Response — the current code returns `response` with status 503 but FastAPI's `status_code=204` decorator wins and sends an empty 204.

- [ ] **Step 1: Write failing tests for the four view endpoints and the two fixes**

Create `backend/tests/conftest.py`:

```python
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("MICEMAX_DB", str(ROOT / "data" / "micemax.db"))

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)
```

Create `backend/tests/test_catalog.py` with these exact assertions (fixtures from the table above):

- `test_health`: GET /health → 200, `{"status": "ok"}`.
- `test_conferences_lists_two_demos`: GET /api/conferences → ids exactly `["jadm32", "icep2027"]`.
- `test_conference_view_bundle`: GET /api/conferences/jadm32/view → `conference["main_venue_place_id"] == "scc"`, `len(sessions) == 210`, `len(windows) == 15`, every window has a `plan_kinds` list of strings, `len(headlines) == 4`.
- `test_conference_view_experiences_travel_join`: same call → 90 experiences, none has kind `extra_night` with a missing travel row (all 90 have a travel row from `scc`), every `fields` value is a list.
- `test_conference_view_unknown_id`: GET /api/conferences/nonsense/view → 404.
- `test_experience_detail_combo`: GET /api/experiences/combo-moiwa-night-view-and-miso-ramen/detail → `is_combo` true, `len(photos) == 2`, `len(stops) == 2`, `copy["ja"]["card_title"]` is a nonempty string, `len(travel) == 3` (one per venue).
- `test_experience_detail_unknown`: GET /api/experiences/nonsense/detail → 404.
- `test_experience_counts`: GET /api/conferences/jadm32/counts → `["short-donbe-nijo-market"] == 17`.
- `test_session_moment`: GET /api/session?month=3 → `season["high_c"] == 4.5`, `city_events` is a list.

Create `backend/tests/test_views.py`:

- `test_city_view_totals`: GET /api/city/view → `len(estimates) == 32`, `scales["jadm32"] == 3.0`, `reach["jadm32"] == {"reached": 193, "total": 1000}`, `by_kind` entries for `evening`, `extra_night`, `short`, `specialist`, `by_kind` for `evening` has `count == 252` and `jpy == 1043914` (both conferences), every `by_area` row has nonempty `area` and `area_ja` strings (no nulls — the fallback).
- `test_organize_view`: GET /api/organize/jadm32/view → `window_stats["short-donbe-nijo-market"] == {"shown": 276, "joined": 17}`, `len(windows) == 15`, `len(experiences) == 90`.
- `test_organize_view_unknown`: GET /api/organize/nonsense/view → 404.

Create `backend/tests/test_events.py`:

- `test_append_event_503_without_database_url`: DELETE DATABASE_URL from env, POST /api/events with a valid body → 503 with `{"detail": "event log unavailable"}`. (Monkeypatch `os.environ` so a real DATABASE_URL on this machine never leaks a write; also monkeypatch `app.main.neon_write` to raise `RuntimeError` to force the failure path deterministically.)
- `test_append_event_validates`: POST with `event_type: "nonsense"` → 422; unknown `conference_id` → 400; unknown `experience_id` → 400.
- `test_append_event_shape_ok_with_fake_write`: monkeypatch `neon_write` to record calls → 204, and the recorded row has all 11 columns non-null where the model requires them (event_id is a UUID string, ts is an ISO string with timezone).

- [ ] **Step 2: Run tests, watch them fail**

Run: `cd backend && uv run --no-dev pytest tests/ -x -q`
Expected: `experiences`-join test fails with OperationalError; `append_event` 503 test fails (returns 204); the four view endpoints fail with 404 (they don't exist yet).

- [ ] **Step 3: Fix the two bugs and add the five endpoints in `backend/app/main.py`**

- Fix `experiences()` join as specified in Interfaces.
- Fix `append_event`: drop `status_code=204` from the decorator, return `Response(status_code=204)` on success and `JSONResponse(status_code=503, content={"detail": "event log unavailable"})` on `RuntimeError`.
- Add the five endpoints (`/view` bundles, `/api/session`, `/api/conferences/{cid}/counts`) reusing the existing `q`/`q1`/`rows_json`/`parse_json_cols` helpers. Keep the SQL parameterized. Window `plan_kinds` and experience `fields` parse through `parse_json_cols`.
- Keep endpoint count and docstrings small; one comment only where the SQL join needs explanation.

- [ ] **Step 4: Run tests, watch them pass**

Run: `cd backend && uv run --no-dev pytest tests/ -q`
Expected: all pass (19 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "backend: view endpoints, event 503 body, join fix, tests"
```

---

### Task 2: The API island + language plumbing in the UI

**Files:**
- Create: `ui/src/scripts/api.ts` (the one fetch helper), `ui/src/components/ApiError.astro` (small reusable error block)
- Modify: `ui/src/components/Header.astro` (toggle dispatches a `micemax:lang` event after setting the cookie), `ui/src/layouts/Base.astro` (inline lang script), `ui/src/env.d.ts` (already has `PUBLIC_API_BASE`; confirm), `ui/package.json` (no change expected)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by every later task):
  - `api.ts` exports `API_BASE` (string, `import.meta.env.PUBLIC_API_BASE ?? ""`), `getLang(): "ja" | "en"` (reads the `lang` cookie, defaults "en"), `onLangChange(cb: (lang) => void)` (listens for the `micemax:lang` custom event), `api<T>(path: string): Promise<T>` (fetch with `Accept: application/json`; on non-2xx throws `ApiError` with `.status`), and `type ApiError`.
  - `Header.astro` toggle click: sets the cookie (existing), then `document.dispatchEvent(new CustomEvent("micemax:lang", { detail: lang }))`. The page-reload behavior goes away (islands re-render in place; static chrome re-renders on the `micemax:lang` event too — see below).
  - `Base.astro`: replace `getLang(Astro.cookies)` with a 3-line inline `<script is:inline>` that reads the cookie and sets `document.documentElement.lang`. Static chrome strings (page `<title>`, header) stay English-first; the toggle event re-renders islands, and `title`/`aria-label`s that were translated move into islands where they matter.
  - `ApiError.astro`: takes `lang` via a `data-lang` attribute set by the island (islands re-render this block with `lang` swapped), shows `t(lang, "common.apiError")` + a Retry button that calls a retry callback supplied via a custom event (`micemax:retry`) — the island listens and refetches. Add the `common.apiError` and `common.retry` keys to both i18n files (EN: "Couldn't reach the MiceMax service." / "Retry"; JA: 「MiceMaxのサービスに接続できませんでした。」 / 「再試行」).

- [ ] **Step 1: Write the failing test** — a tiny node script is not worth a test file here; the test is `astro check` plus the Task 3+ pages actually using these helpers. Instead: add the two i18n keys first (they are the failing "test": `t()` throws on a missing key), then run `npx astro check` to watch nothing break.

Run: `cd ui && npx astro check`
Expected: 0 errors (the keys exist but nothing consumes them yet — this task's proof is Task 3's calendar island rendering).

- [ ] **Step 2: Implement `api.ts`, `ApiError.astro`, header event, Base lang script**

`api.ts` sketch (the implementer writes the body):

```ts
export const API_BASE: string;
export type Lang = "en" | "ja";
export function getLang(): Lang;
export function onLangChange(cb: (lang: Lang) => void): void;
export class ApiError extends Error { status: number }
export async function api<T = unknown>(path: string): Promise<T>;
```

- [ ] **Step 3: Verify with astro check and a quick dev run**

Run: `cd ui && npx astro check && npm run build`
Expected: 0 errors, build completes. (The dev server is not started by the agent — see ui/AGENTS.md: `astro dev --background` is for the user.)

- [ ] **Step 4: Commit**

```bash
git add ui/src/scripts/api.ts ui/src/components/ApiError.astro ui/src/components/Header.astro ui/src/layouts/Base.astro ui/src/i18n/
git commit -m "ui: api island helpers and language event"
```

---

### Task 3: Calendar page (`/c/[conference]`) — the big island

**Files:**
- Modify: `ui/src/pages/c/[conference].astro` (shell), `ui/src/components/WindowRow.astro` → replaced by a TS renderer in the island (delete the Astro component; its markup moves), `ui/src/components/PlanCard.astro` stays for session rows rendered island-side as HTML strings
- Create: `ui/src/scripts/calendar-view.ts` (the island custom element `<calendar-view data-conference="jadm32">`)

**Interfaces:**
- Consumes: Task 2's `api`, `getLang`, `onLangChange`, `ApiError`; Task 1's `/api/conferences/{cid}/view` and `/api/session?month=`; Task 1's counts via `/api/conferences/{cid}/counts` (not needed here); the ported `fitsWindow` stays in `ui/src/data/fit.ts` (unchanged file, now fed by fetched data); `sunsetSapporo` and `yen` from `ui/src/data/city.ts` (unchanged).
- Produces: `<calendar-view data-conference data-attendee-id>` custom element that renders the whole data-driven part of the calendar: moment line, extra-night banner, first-visit banner slot, and per-day sections (sessions via PlanCard markup, windows via the ported WindowRow markup, `my-plans` islands stay as-is inside each day). Fetches `/view` + `/api/session` once, then renders; re-renders on `micemax:lang`.

Data flow (matching the old frontmatter exactly):
1. Fetch view bundle. If 404 → render not-found text (`t(lang, "common.notFound")` — add key, EN "Not found." / JA 「見つかりません。」) + a link home. If ApiError → render `ApiError` block with retry.
2. Suggestion selection per window (port the existing frontmatter logic verbatim): headline first (from `headlines`), then by shown count desc, filtered by `fitsWindow(e, w, travelMinutes, conf)` where travel comes from the experience's travel row for `conference.main_venue_place_id`, cap 4, skip experiences without copy in the current language.
3. Fit rule: use `w.plan_kinds` (now present on fetched windows) in `fitsWindow` when the array is nonempty, falling back to `KINDS_BY_WINDOW` when empty — a two-line change in `ui/src/data/fit.ts`.
4. Extra-night banner: headline experience of each `extra_night` window, hero photo first. **Ruling:** the view bundle grows a `photos` map `{experience_id: [photo rows]}` for headline experiences only (4 per conference), fetched server-side in the same query as headlines. The event page fetches full photos from `/detail`. This keeps the banner one round trip without shipping 213 photo rows.
5. Moment line: `seasonFor(month)` + `cityEventsBetween(conf.start_date, conf.end_date)` client-side from `/api/session?month=` + `sunsetSapporo(conf.start_date)`.
6. Attendee chip: fetch `/api/attendees/{attendeeId}` (from `data-attendee-id`, defaulting to the demo id — the cookie is set by login client-side; the shell reads it via inline script and passes it as a data attribute).

- [ ] **Step 1: Write the failing test — `ui/tests/calendar.test.ts`**

This project has no test runner yet; add `vitest` as a devDependency (`npm i -D vitest`) with a `test` script `vitest run`. The island's pure logic is testable without a DOM by extracting it: `ui/src/scripts/calendar-view.ts` exports `selectSuggestions(exps, windows, stats, headlines, conf, travelOf, copyOf, lang)` and `buildDays(conf)` alongside the custom element.

```ts
import { describe, it, expect } from "vitest";
import { selectSuggestions, buildDays } from "../src/scripts/calendar-view";

const conf = { id: "jadm32", field: "medicine", field_detail: "disaster medicine", main_venue_place_id: "scc" };
const shortExp = { id: "short-donbe-nijo-market", kind: "short", duration_min: 60, fields: [] };
const specExp = { id: "spec-sapporo-citizens-disaster-prevention", kind: "specialist", fields: ["disaster_medicine"] };
const shortWindow = { id: "w1", kind: "lunch", start_time: "12:00", end_time: "13:00", plan_kinds: ["short"] };
const specWindow = { id: "w2", kind: "lunch", start_time: "12:00", end_time: "15:00", plan_kinds: ["specialist"] };

describe("selectSuggestions", () => {
  it("keeps only experiences whose kind is in the window plan_kinds", () => {
    const out = selectSuggestions([shortExp, specExp], [specWindow], new Map(), [], conf, () => undefined, () => ({ card_title: "x" }), "en");
    expect(out.get("w2")!.map((s) => s.experience.id)).toEqual(["spec-sapporo-citizens-disaster-prevention"]);
  });
  it("pins the headline first", () => {
    const stats = new Map([["short-donbe-nijo-market", { shown: 276, joined: 17 }]]);
    const out = selectSuggestions([shortExp, specExp], [shortWindow], stats, [{ window_id: "w1", experience_id: "short-donbe-nijo-market" }], conf, () => ({ mode: "walk", minutes: 5 }), () => ({ card_title: "x" }), "en");
    expect(out.get("w1")![0].experience.id).toBe("short-donbe-nijo-market");
    expect(out.get("w1")!.length).toBeLessThanOrEqual(4);
  });
});

describe("buildDays", () => {
  it("lists each day from start to end inclusive", () => {
    expect(buildDays({ start_date: "2027-03-18", end_date: "2027-03-20" })).toEqual(["2027-03-18", "2027-03-19", "2027-03-20"]);
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `cd ui && npx vitest run tests/calendar.test.ts`
Expected: FAIL (module has no exports yet).

- [ ] **Step 3: Implement the island and the page shell**

- Move the frontmatter logic into `calendar-view.ts`; the page keeps: fetchless shell with `<calendar-view data-conference={...}>`, the `<my-plans>` slots move inside the island's day rendering (it re-creates them per day so `my-plans.ts` keeps working — it is already a custom element that reads localStorage).
- Delete `WindowRow.astro` after porting its markup into the island's render (keep the exact class strings).
- Static chrome (title) uses the conference name — but the shell doesn't know it. **Ruling:** the shell renders a static fallback title "MiceMax" and the island sets `document.title` once data arrives. Cheap and correct.
- Loading state: a `t(lang, "common.loading")` line (add key, EN "Loading…" / JA 「読み込み中…」) rendered by the shell in both languages via the inline lang script (or a `<noscript>`-safe default English line the island replaces).

- [ ] **Step 4: Run the test, watch it pass**

Run: `cd ui && npx vitest run tests/calendar.test.ts && npx astro check`
Expected: tests pass, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/c/ ui/src/components/ ui/src/scripts/calendar-view.ts ui/src/data/fit.ts ui/src/i18n/ ui/tests/ ui/package.json ui/package-lock.json
git commit -m "ui: calendar page fetches the backend view bundle"
```

---

### Task 4: Experience page (`/c/[conference]/e/[experience]`) + book button wiring

**Files:**
- Modify: `ui/src/pages/c/[conference]/e/[experience].astro` (shell), `ui/src/scripts/book-button.ts` (reads conference from a data attribute now, not the prefix guess)
- Create: `ui/src/scripts/experience-view.ts`

**Interfaces:**
- Consumes: Task 1 `/api/experiences/{eid}/detail`, `/api/experiences/{eid}/attendees`, `/api/conferences/{cid}/counts`; Task 2 helpers; existing `plan-store`, `event-log`.
- Produces: `<experience-view data-conference data-experience>` rendering photos, price line (with `common.priceFrom` when `price_max_jpy` exists), and travel. `/detail` returns travel rows for every venue; the island needs the conference's `main_venue_place_id` to pick one. **Ruling:** the island fetches `/api/conferences` (2 rows, small) and picks the conference by its data attribute. Accepted extra round trip; no new endpoint.
- `book-button.ts` drops `guessConference` and reads `data-conf` (already set by the shell; the island passes it through when creating the button).

- [ ] **Step 1: Write the failing test — `ui/tests/experience.test.ts`**

Extract `priceLine(exp, lang, t)` and `pickTravel(travelRows, venueId)` into `experience-view.ts` exports.

```ts
import { describe, it, expect } from "vitest";
import { priceLine, pickTravel } from "../src/scripts/experience-view";

describe("priceLine", () => {
  it("shows Free for zero", () => {
    expect(priceLine({ price_jpy: 0, price_max_jpy: null }, "en")).toBe("Free");
  });
  it("shows price-from when a max exists", () => {
    expect(priceLine({ price_jpy: 3480, price_max_jpy: 9000 }, "en")).toContain("¥3,480");
  });
  it("returns null when unpriced", () => {
    expect(priceLine({ price_jpy: null, price_max_jpy: null }, "en")).toBeNull();
  });
});

describe("pickTravel", () => {
  it("picks the main venue's row", () => {
    const rows = [
      { venue_place_id: "scc", mode: "transit", minutes: 20 },
      { venue_place_id: "grand-mercure-odori", mode: "transit", minutes: 18 },
    ];
    expect(pickTravel(rows, "scc")).toEqual({ venue_place_id: "scc", mode: "transit", minutes: 20 });
  });
  it("returns undefined for an unknown venue", () => {
    expect(pickTravel([], "scc")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `cd ui && npx vitest run tests/experience.test.ts`
Expected: FAIL (no exports).

- [ ] **Step 3: Implement the island; wire book-button to `data-conf`; not-found and error states**

- [ ] **Step 4: Run the test, watch it pass**

Run: `cd ui && npx vitest run tests/experience.test.ts && npx astro check`
Expected: pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/c/ ui/src/scripts/
git commit -m "ui: experience page island with per-venue travel and price line"
```

---

### Task 5: Mock checkout (`/checkout`) as a static page

**Files:**
- Modify: `ui/src/pages/checkout.astro` (shell reads nothing server-side; the inline `<script>` grows to parse query params, fetch the experience's copy via `/detail`, and render name/price/total before allowing pay)

**Interfaces:**
- Consumes: Task 1 `/api/experiences/{eid}/detail`; `plan-store`, `event-log` (unchanged signatures).
- Produces: the same visual page; `data-*` attributes filled by the island instead of the frontmatter. Keep the form-submission flow identical (`putPlan` + `logEvent("plan_booked")` + redirect). The back link needs the conference id: read it from the query string (the experience page already passes `conf`).

- [ ] **Step 1: Write the failing test — `ui/tests/checkout.test.ts`** for `parseCheckoutQuery(params): {exp, conf, day, start, end, party, price} | null` (null when `exp` is missing) and `total(price, party)`.

```ts
import { describe, it, expect } from "vitest";
import { parseCheckoutQuery, total } from "../src/pages/checkout-helpers";

describe("parseCheckoutQuery", () => {
  it("reads every param", () => {
    const p = new URLSearchParams("exp=e1&conf=jadm32&party=3&price=3480&day=2027-03-18&start=19:15&end=23:00");
    expect(parseCheckoutQuery(p)).toEqual({ exp: "e1", conf: "jadm32", party: 3, price: 3480, day: "2027-03-18", start: "19:15", end: "23:00" });
  });
  it("is null without exp", () => {
    expect(parseCheckoutQuery(new URLSearchParams())).toBeNull();
  });
});

describe("total", () => {
  it("multiplies price by party", () => {
    expect(total(3480, 3)).toBe(10440);
  });
});
```

- [ ] **Step 2: Run the test, watch it fail** (`checkout-helpers.ts` doesn't exist; create it under `ui/src/pages/` so the page imports it).

- [ ] **Step 3: Implement the island logic in the page's script**

- [ ] **Step 4: Run the test, watch it pass**

Run: `cd ui && npx vitest run tests/checkout.test.ts && npx astro check`
Expected: pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/checkout.astro ui/src/pages/checkout-helpers.ts ui/tests/
git commit -m "ui: checkout reads its item client-side"
```

---

### Task 6: City view (`/city`)

**Files:**
- Modify: `ui/src/pages/city.astro` (shell + island)
- Create: `ui/src/scripts/city-view.ts`

**Interfaces:**
- Consumes: Task 1 `/api/city/view` (pre-aggregated `by_kind`, `by_area`, `reach`, `scales`, `estimates`, `spend`); Task 2 helpers; `yen` from `data/city.ts`.
- Produces: `<city-view>` rendering all sections. The old frontmath (reached scaling, scaled totals) ports verbatim into `city-view.ts` exports for tests: `reachedTotal(reach, scales, demoIds)`, `scaledTotals(spend, scales, demoIds)`.

- [ ] **Step 1: Write the failing test — `ui/tests/city.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { reachedTotal, scaledTotals } from "../src/scripts/city-view";

const reach = { jadm32: { reached: 193, total: 1000 }, icep2027: { reached: 162, total: 1000 } };
const scales = new Map([["jadm32", 3.0], ["icep2027", 1.2]]);

describe("reachedTotal", () => {
  it("scales reached counts to real conference sizes", () => {
    expect(reachedTotal(reach, scales)).toBe(193 * 3 + 162 * 1.2);
  });
  it("skips conferences with no reach row", () => {
    expect(reachedTotal({ jadm32: reach.jadm32 }, scales)).toBe(579);
  });
});

describe("scaledTotals", () => {
  it("counts and sums with the scale factor", () => {
    const out = scaledTotals([{ conferenceId: "jadm32", jpy: 3480 }], scales);
    expect(out).toEqual({ count: 3, jpy: 10440 });
  });
});
```

Note the exact fixture math: 193×3.0 = 579, 162×1.2 = 194.4 — the old code `Math.round`s per conference (579 + 194 = 773). Match the old code's rounding (`Math.round` after each conference), so the test's first assertion is `773`.

- [ ] **Step 2: Run the test, watch it fail**
- [ ] **Step 3: Implement the island + port the math**
- [ ] **Step 4: Run the test, watch it pass** (`npx vitest run tests/city.test.ts && npx astro check`)
- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/city.astro ui/src/scripts/city-view.ts ui/tests/
git commit -m "ui: city view reads the backend aggregate"
```

---

### Task 7: Organizer pages (`/organize`, `/organize/[conference]`)

**Files:**
- Modify: `ui/src/pages/organize.astro` (shell: static entry, upload simulation script unchanged — it's already client-only; stored-conference list becomes an island fetch of `/api/conferences`), `ui/src/pages/organize/[conference].astro` (shell + island)
- Create: `ui/src/scripts/organizer-view.ts`

**Interfaces:**
- Consumes: Task 1 `/api/organize/{cid}/view` (has `window_stats` per experience, `experiences`, `sessions`, `windows`, `conference`); Task 2 helpers; existing `organizer-approve.ts` custom element (the island creates `<organizer-window>` wrappers so it keeps working); `fitsWindow` from `data/fit.ts`.
- Produces: `<organizer-view data-conference>` rendering the program calendar with suggestion rows (shown/joined counts from `window_stats`, not the old `stats.get(e.id)` map — same numbers, new source), remove buttons, share section. `shareUrl` becomes `${window.location.origin}/c/${conf.id}` computed client-side. Cap stays 6 suggestions per window (the organizer sees more than attendees' 4).
- QR code: the external `api.qrserver.com` img stays (it's a public API, no secret).

- [ ] **Step 1: Write the failing test — `ui/tests/organizer.test.ts`** for `shareUrlFor(origin, confId)` and `suggestionOrder(exps, window, stats, headlines, travelOf, copyOf, lang)` (headline first, then shown desc, cap 6, plan_kinds respected — reuse `selectSuggestions` from Task 3 with cap parameter; export it with an options arg `{ cap }` from `calendar-view.ts` and have the organizer import it).

```ts
import { describe, it, expect } from "vitest";
import { shareUrlFor } from "../src/scripts/organizer-view";

describe("shareUrlFor", () => {
  it("builds the attendee link", () => {
    expect(shareUrlFor("https://micemax.example", "jadm32")).toBe("https://micemax.example/c/jadm32");
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**
- [ ] **Step 3: Implement both pages**
- [ ] **Step 4: Run the test, watch it pass** (`npx vitest run tests/organizer.test.ts && npx astro check`)
- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/organize/ ui/src/scripts/organizer-view.ts ui/tests/
git commit -m "ui: organizer pages read the backend organize view"
```

---

### Task 8: Home + login pages (`/`, `/login`)

**Files:**
- Modify: `ui/src/pages/index.astro` (the routes list becomes an island: fetch `/api/conferences` + both view bundles in parallel — 90 experiences each, small JSON — and render the links plus the first 3 experience links per conference), `ui/src/pages/login.astro` (form stops POSTing to `/api/login`; the submit handler sets the attendee cookie client-side — `document.cookie = "micemax_attendee=jadm32-a0081; path=/; max-age=2592000"` — then `logEvent("page_visited")` and `location.href = "/c/jadm32"`; the password-hint line and consent removal already in the working tree stay)
- Delete: `ui/src/pages/api/login.ts`, `ui/src/pages/api/book.ts` (the SSR endpoints doc 11 says go away)

**Interfaces:**
- Consumes: `/api/conferences`, both view bundles (home); the client-side cookie (login).
- Produces: home island `<home-links>`; login is plain static HTML + the small script. `ATTENDEE_COOKIE`/`DEMO_ATTENDEE_ID` move from `ui/src/data/attendee.ts` into a shared `ui/src/scripts/attendee-cookie.ts` (the old file keeps `getLang` for any straggler imports until Task 9 deletes it).

- [ ] **Step 1: Write the failing test — `ui/tests/home.test.ts`** for `routeList(conferences, lang)` returning `{path, label, note}[]` including `/login` first (the experience sub-links are an island nicety; keep them out of the tested surface — they render from the same data without extra logic).

- [ ] **Step 2: Run the test, watch it fail**
- [ ] **Step 3: Implement both pages; delete the two api endpoints**
- [ ] **Step 4: Run the test, watch it pass** (`npx vitest run tests/home.test.ts && npx astro check`)
- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/index.astro ui/src/pages/login.astro ui/src/scripts/ ui/tests/
git rm ui/src/pages/api/login.ts ui/src/pages/api/book.ts
git commit -m "ui: home and login go client-side; SSR endpoints deleted"
```

---

### Task 9: Static output + config + README

**Files:**
- Modify: `ui/astro.config.mjs` (drop the netlify adapter import and `adapter:` line; Astro defaults to static), `ui/package.json` (remove `@astrojs/netlify` and `@astrojs/node` dependencies), `ui/src/data/attendee.ts` (delete — its `getLang` moved to `api.ts`, cookie constants to `attendee-cookie.ts`; fix the login page import if it still references it), `ui/README.md` (rewrite Stack + structure sections for the static split: pages are shells, `src/scripts/` islands fetch `PUBLIC_API_BASE`, build command `npm run build`, publish `dist`, photos still copied into `public/images`)

**Interfaces:**
- Consumes: everything prior.
- Produces: `npm run build` produces a purely static `dist/` with no server bundle; `npx astro check` passes; `npx vitest run` passes.

- [ ] **Step 1: Write the failing check — the build output check**

```bash
cd ui && npm run build && ls dist/ && ! test -d dist/_worker.js && echo "static ok"
```
Expected before the fix: `dist/_worker.js` exists (Netlify adapter), so the `!` check fails.

- [ ] **Step 2: Make the changes**
- [ ] **Step 3: Run the check again**

Run: `cd ui && npm run build && ! test -d dist/_worker.js && npx astro check && npx vitest run`
Expected: static ok, 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add ui/astro.config.mjs ui/package.json ui/package-lock.json ui/README.md ui/src/data/
git commit -m "ui: fully static build, adapter removed"
```

---

### Task 10: Event-log POST resilience (backend + UI)

**Files:**
- Modify: `ui/src/scripts/event-log.ts` (keepalive fetch already there; add explicit conference param so `guessConference` dies — every call site passes `conferenceId` explicitly from the page context the shell knows), `backend/tests/test_events.py` (already covers 503; add the CORS preflight test here)

**Interfaces:**
- Consumes: Task 1's 503 behavior (now a JSON body).
- Produces: `logEvent(type, { conferenceId, ...opts })` — `conferenceId` required; call sites updated in Tasks 4 (book button, checkout) and 8 (login). The old `guessConference` prefix map is deleted.

- [ ] **Step 1: Write the failing test — `backend/tests/test_events.py::test_cors_preflight`**: OPTIONS /api/events with `Origin: https://micemax-demo.netlify.app` and `Access-Control-Request-Method: POST` → 200 with `access-control-allow-origin` in headers (default `*` CORS in the test env).

- [ ] **Step 2: Run the test, watch it fail or pass** — if it passes immediately, the middleware already covers it; the step's value is the regression net. Record either way.

- [ ] **Step 3: Update `event-log.ts` signature and all call sites; delete `guessConference`**

- [ ] **Step 4: Run the checks**

Run: `cd backend && uv run --no-dev pytest tests/ -q && cd ../ui && npx astro check && npx vitest run`
Expected: backend all pass; UI 0 errors, all pass.

- [ ] **Step 5: Commit**

```bash
git add ui/src/scripts/event-log.ts ui/src/scripts/book-button.ts ui/src/pages/checkout.astro ui/src/pages/login.astro backend/tests/
git commit -m "event log: explicit conference id, CORS preflight test"
```

---

### Task 11: End-to-end verification of all nine screens

**Files:**
- Modify: none (this task verifies; fixes land in the tasks above)

**Interfaces:**
- Consumes: everything.
- Produces: confidence that the split works; a list of fixes if anything broke.

- [ ] **Step 1: Start the backend against the real DB**

Run: `cd backend && .venv/bin/uvicorn app.main:app --port 8787 &` (background; kill it after)

- [ ] **Step 2: Start the UI dev server with the API base set**

Run: `cd ui && PUBLIC_API_BASE=http://localhost:8787 npx astro dev --background` (per ui/AGENTS.md background mode; manage with `astro dev stop`)

- [ ] **Step 3: Walk the demo order with curl + the browser**

The agent verifies the data plane with curl; the human walks the browser demo (the agent cannot click):

```bash
curl -s localhost:8787/api/conferences/jadm32/view | head -c 400
curl -s localhost:8787/api/experiences/combo-moiwa-night-view-and-miso-ramen/detail | python3 -m json.tool | head -30
curl -s "localhost:8787/api/city/view" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['estimates']), d['scales'])"
```
Expected: JSON in the documented shapes; 90 experiences; 32 estimates; scale 3.0.

- [ ] **Step 4: Check every simulated number still carries a label**

Open each page's rendered HTML (curl from dev server) and grep for the simulated label component usage or its rendered text. City view and any simulated counts must show `common.simulated`.

- [ ] **Step 5: Check JA completeness** — toggle to JA on each screen; the i18n module throws on a missing key, so a broken page means a missing key. Confirm no console errors.

- [ ] **Step 6: Record the walkthrough result in the final report; fix anything broken in the owning task's file with a test first.**

- [ ] **Step 7: Commit any fixes**

```bash
git add -A ui/ backend/
git commit -m "fix: e2e walkthrough findings"
```

---

### Task 12: Docs alignment (README, deployment plan, decisions)

**Files:**
- Modify: `ui/README.md` (already partially rewritten in the working tree; make it match the final state), `docs/10-deployment-plan.md` (replace the Netlify-SSR steps with the split: backend on Render first, then static frontend on Netlify with `PUBLIC_API_BASE` set at build time, then CORS on the backend with the frontend origin and one backend redeploy; env var table gains `PUBLIC_API_BASE` (frontend, build time) and keeps `DATABASE_URL`, `CORS_ORIGINS` (backend); troubleshooting table loses the `node:sqlite` row, gains "backend asleep → open the URL a minute before the demo"), `docs/11-split-deployment-design.md` (update the frontend-changes section to match what shipped: runtime fetch islands, language event, no SSR endpoints), `docs/05-decisions-and-open-questions.md` (add a decision line for the runtime-fetch choice the user made)

**Interfaces:**
- Consumes: the final code state.
- Produces: docs that match reality.

- [ ] **Step 1: Rewrite the four docs** (concise; the deployment plan keeps its step structure)
- [ ] **Step 2: Verify links resolve** — `rg -o '\]\(([^)]+\.md)' docs/ -r '$1'` style check, or simply open each changed doc's links
- [ ] **Step 3: Commit**

```bash
git add docs/ ui/README.md
git commit -m "docs: match the static-ui split"
```

---

### Task 13: Whole-branch review + final suite run

**Files:**
- Modify: whatever the review finds.

- [ ] **Step 1: Run the full suite one last time**

Run: `cd backend && uv run --no-dev pytest tests/ -q && cd ../ui && npx astro check && npx vitest run && npm run build`
Expected: everything green.

- [ ] **Step 2: Dispatch the code reviewer** on the branch diff (merge-base `main`… HEAD) with the plan and spec paths, per superpowers:requesting-code-review. Fix Critical/Important findings with tests; ledger the minors.

- [ ] **Step 3: Commit fixes, report.**
