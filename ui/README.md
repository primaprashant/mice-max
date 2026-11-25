# UI

The screens for the MiceMax demo. The plan is [docs/09-ui-plan.md](../docs/09-ui-plan.md); read it before writing code, with [docs/03-hackathon-scope.md](../docs/03-hackathon-scope.md) and [docs/05-decisions-and-open-questions.md](../docs/05-decisions-and-open-questions.md).

## Stack

Astro 7 with Tailwind 4 and Phosphor icons, server-rendered (Netlify adapter). Pages read the cookie for language, so they render per request; the client islands (custom elements and side-effect scripts in `src/scripts/`) handle interaction: the language toggle, the day tabs, the book/join button, the attendee's plan blocks in the day grid, the first-visit banner, the suggestion shown-log, and the organizer's remove button. Node 22.

## Structure

```text
/
├── public/            # static assets; public/images holds the photos copied from data/images, plus public/images/login
├── src/
│   ├── components/    # DayGrid, PlanCard, WindowRow, Header, SimulatedLabel
│   ├── data/          # the one data module: index.ts, types.ts, fit.ts, city.ts, city-view.ts, attendee.ts
│   ├── i18n/          # en.json and ja.json, read through src/i18n/index.ts
│   ├── layouts/       # Base.astro: page shell, fonts, theme
│   ├── pages/         # the screens, listed below
│   ├── scripts/       # client islands: plan-store, layout, book-button, my-plans, day-tabs, lang-toggle, first-visit-banner, suggest-log, event-log, organizer-approve
│   └── styles/        # global.css: theme tokens
└── package.json
```

## Screens

| Route | Screen |
| :---- | :----- |
| `/` | Home: links to the two demo conferences and the login page |
| `/login` | Attendee login: name, dummy password; full-bleed Sapporo photo (random from `public/images/login`), language toggle |
| `/c/:conference` | Attendee calendar: day tabs, one Google-Calendar-style grid per day (sessions tinted by type, free-time windows dashed), suggestion cards below the grid, extra-night banner, moment line (weather, computed sunset, city events), first-visit banner |
| `/c/:conference/e/:experience` | Experience page: photos, price, travel time, stops for combos, tags, who is going (from the simulated log), book/join |
| `/checkout` | Mock checkout; nothing is charged |
| `/organize` | Organizer entry: upload path (progress, error, retry) or a stored conference |
| `/organize/:conference` | Program calendar with windows, suggestions with shown/joined counts, one-click remove, share screen (link, QR, email text) |
| `/city` | City dashboard: reached, bookings, scaled spend, splits by type and area, next-12-months table, the money formula, all labelled simulated |
| `/api/login` | Endpoint that sets the attendee cookie |

## What exists

- `src/styles/global.css` holds the theme tokens: `theme` (single accent: buttons, links, focus), `banana` (MiceMax events marker), the `session-*` tints for the day grid's session types, and `paper`, `ink`, `ink-soft`. Use the tokens; no raw color values.
- `src/i18n/` holds the language module. `t(lang, key)` reads a dotted key from `en.json` or `ja.json` and throws on a missing key, so a hardcoded string fails fast. English is the default; the docs require Japanese complete, not partial.
- `src/data/index.ts` is the only place that reads data. It reads the committed SQLite master copy (`data/micemax.db`) when no Neon connection is set; the Neon swap replaces the bodies of these functions, not the screens.
- `src/data/fit.ts` ports the simulator's `fits` rule (data/scripts/simulate.py), so the UI's suggestions match the graph's FITS edges.
- `src/data/city.ts` computes sunset for Sapporo in code (not stored) and formats yen.
- `src/scripts/layout.ts` is the shared overlap layout: DayGrid.astro (server) and my-plans.ts (client) both place blocks through it, so plan blocks line up with session blocks.
- The attendee's plans are client-side: `src/scripts/plan-store.ts` holds them in localStorage; the book/join button, mock checkout and the calendar's `my-plans` island all read and write through it. This is the demo trade-off named in the plan; production stores plans in the database.
- Suggestions per window: the headline experience pinned first (D29), then by `plan_shown` counts from the event log, all filtered by the fit rule, capped at 4. The calendar logs `plan_shown` for the cards it renders (once per browser session, visible panels only).
- Login photos: `public/images/login/` holds compressed WebP converted from the originals; sources in `MANIFEST.md` there.

## Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

## Development

Start the dev server in background mode:

```sh
astro dev --background
```

Manage it with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Local development reads `data/micemax.db` when no Neon connection is set, so every screen works offline. Photos are files under `data/images/`, copied into `public/images/` (a build step should do this; it was done manually this session).

The Astro guides: [docs.astro.build](https://docs.astro.build)
