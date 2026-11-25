# MiceMax: deployment plan

How to put the demo on the internet. The deploy is one Netlify site; everything behind it is managed.

## Tool choice

Netlify deploys the app straight from this GitHub repo, runs the build on every push, and runs the Astro server endpoints on its free tier. The endpoints are the only place that touches Neon and Neo4j, because the credentials must stay off the browser ([09-ui-plan.md](09-ui-plan.md), "Data"). Server endpoints need server-side rendering, or SSR: pages and endpoints are produced by code that runs on the server when a visitor asks for them.

One code change is needed: swap the Node adapter for the Netlify adapter in [ui/astro.config.mjs](../ui/astro.config.mjs). See step 0. Render could host the Node build with no code change, but Netlify is free and needs no account setup beyond GitHub sign-in.

| What | Where it lives | Deployed as |
| --- | --- | --- |
| Web app | `ui/` | Netlify site (SSR) |
| Data (bookings, event log) | Neon Postgres | Managed service, no deploy |
| Graph (matching, ranking) | Neo4j Aura | Managed service, no deploy |
| Offline fallback | `data/micemax.db`, committed | Part of the repo, read-only |

## Before the first deploy

1. `npm run build` in `ui/` must pass. It fails today on `src/components/PlanCard.astro` while that file is being rewritten. Do not deploy until it passes.
2. Decide the data source. Two options:
   - SQLite fallback: no configuration, but the module opens the file read-only, so bookings and the event log do not persist.
   - Neon: set `DATABASE_URL`. The data module throws when this variable is set, because the Postgres swap in `src/data/index.ts` is not wired yet. Deploy with Neon only after that swap lands.
3. Make sure that you know how photos reach `public/`. The UI plan says a build step or symlink copies `data/images/` there. Whatever it is, it must run in the Netlify build, so put it in the build command.
4. No secrets in code: the repo is open source, and `DATABASE_URL` lives only in the Netlify dashboard.

## Step 0: swap the adapter

In `ui/`:

```sh
npm install @astrojs/netlify
```

In `ui/astro.config.mjs`, replace the node import and adapter:

```js
import netlify from '@astrojs/netlify';

export default defineConfig({
  adapter: netlify(),
  vite: { plugins: [tailwindcss()] },
});
```

Commit this before connecting the site. `npm run build` must pass after the swap.

## Step 1: create the Netlify site

1. Sign in at app.netlify.com with GitHub.
2. Add new site, then Import an existing project, then pick `primaprashant/mice-max`.
3. Netlify detects Astro and fills the fields. Set or check the build settings in the first table, and set the environment variables from the second table before the first build.
4. Select Deploy site. The first build runs, and Netlify gives the site a URL. Save it.

Build settings:

| Field | Value |
| --- | --- |
| Base directory | `ui` |
| Build command | `npm ci && npm run build` |
| Publish directory | `ui/dist` |

Environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_VERSION` | `22` | `package.json` requires Node 22.23.4 or newer |
| `DATABASE_URL` | leave unset at first | Set it in step 3 |

## Step 2: test the SQLite fallback

If you deploy before the Neon swap is wired, the app reads `data/micemax.db` through a path relative to the built code ([ui/src/data/index.ts](../ui/src/data/index.ts), `DEFAULT_DB_PATH`). That path does not always resolve after the build bundles the module.

1. Open the site URL. If the screens render, the path resolves.
2. If they do not, open the deploy log or the function log in Netlify. A file-not-found error confirms the problem.
3. Fix it in code: read the path from an environment variable with the current value as default, or copy `data/` into the bundle in the build command. Commit, and Netlify redeploys.

## Step 3: set DATABASE_URL

After the data module reads Neon:

1. In the Neon console, copy the pooled connection string.
2. In Netlify, open Site configuration, then Environment variables, and add `DATABASE_URL` with that string.
3. Trigger a redeploy, because endpoints read the variable at boot.
4. Sync the data from the SQLite master copy once. From the repo root, with `DATABASE_URL` in `.env`, run `.venv/bin/python data/scripts/push_neon.py`. It is safe to run again.

The SQLite fallback stays. Local development without the variable reads the committed file, so every screen works offline.

## Step 4: test the deployment

1. Open the site URL.
2. Walk the demo order from [09-ui-plan.md](09-ui-plan.md): attendee calendar, event page, mock checkout, organizer flow, city view.
3. Make sure that every simulated number carries the simulated label.
4. Book one experience, then reload. With `DATABASE_URL` set, the booking stays. Without it, the file is read-only and the booking does not persist.
5. Toggle the language to Japanese. The language module throws on a missing key, so a complete page means the keys are complete.

## Reference

| Variable | Required | Set where | Purpose |
| --- | --- | --- | --- |
| `NODE_VERSION` | yes | Netlify | Pins Node 22 for the build |
| `DATABASE_URL` | when Neon is used | Netlify | Neon pooled connection string |

Auto-deploy: Netlify builds on every push to the production branch, `main` by default, and builds a preview deploy for every pull request. To change the branch, open Site configuration, then Build and deploy, then Continuous deployment.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Build fails with a compile error in `PlanCard.astro` | The file is mid-rewrite. Pull the latest and build locally before debugging on Netlify. |
| Pages return 500 | Open the function log in Netlify. The usual causes are a missing database file (step 2) or a database variable that points nowhere. |
| Error about `node:sqlite` or an unsupported Node version | `NODE_VERSION` is not `22`, or the engines requirement is newer than the build image's Node. Set the variable and redeploy. |
| Photos are missing | The copy of `data/images/` into `public/` did not run. Put it in the build command before `npm run build`. |
| The first request after idle is slow | The serverless function started cold. A second request is fast. No action is needed for the demo. |
| A booking does not persist | `DATABASE_URL` is not set, so the app reads the committed SQLite file read-only. |
| The variable change did nothing | The endpoints read the variable at boot. Trigger a redeploy after changing it. |
