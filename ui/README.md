# UI

The screens for the MiceMax demo. The plan is [docs/09-ui-plan.md](../docs/09-ui-plan.md); read it before writing code, with [docs/03-hackathon-scope.md](../docs/03-hackathon-scope.md) and [docs/05-decisions-and-open-questions.md](../docs/05-decisions-and-open-questions.md).

## Stack

Astro 7 with Tailwind 4 and Phosphor icons. Static pages and components by default, with small client-side islands where a screen needs interaction (calendar, event page, mock checkout, organizer actions). Node 22.

## Structure

```text
/
├── public/            # static assets
├── src/
│   ├── components/    # PlanCard, Header, SimulatedLabel
│   ├── data/          # the one data module: src/data/index.ts
│   ├── i18n/          # en.json and ja.json, read through src/i18n/index.ts
│   ├── layouts/       # Base.astro: page shell, fonts, theme
│   ├── pages/
│   └── styles/        # global.css: theme tokens
└── package.json
```

## What exists

- `src/styles/global.css` holds the theme tokens: `theme` (conference sessions), `banana` (MiceMax events), `paper`, `ink`, `ink-soft`. Use the tokens; no raw color values.
- `src/i18n/` holds the language module. `t(lang, key)` reads a dotted key from `en.json` or `ja.json` and throws on a missing key, so a hardcoded string fails fast. English is the default; the docs require Japanese complete, not partial.
- `src/components/PlanCard.astro` renders one calendar entry or card for a session or an event (`variant="row"` or `"card"`), colored by kind.
- `src/components/Header.astro` is the shared header with the language toggle.
- `src/components/SimulatedLabel.astro` marks simulated data.
- `src/data/index.ts` is the only place that reads data. Today it loads the dummy JSONs in `src/data/dummy/`, which use a made-up conference and an outdated schema. The next step is the swap: the same functions select from the real tables (see "Data" and "Event data" in the plan). Keep the function names so the screens don't change.
- `src/pages/index.astro` is a foundations check page showing the components. Replace it with real screens in the plan's build order.

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

Local development reads `data/micemax.db` when no Neon connection is set, so every screen works offline. Photos are files under `data/images/`, served from `public/`.

The Astro guides: [docs.astro.build](https://docs.astro.build)
