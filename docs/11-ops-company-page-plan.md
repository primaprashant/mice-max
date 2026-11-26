# Ops page redesign: "a company run by AI"

`/ops` stops being a dashboard and becomes the page about MiceMax the company: every job is done by AI agents, one human oversees them, so the same team scales to every conference and city. This page sells our technical skill to the city, so it must impress in the first 3 seconds.

Only `/ops` (index) changes. `/ops/run`, `/ops/sales`, `/ops/:conf`, the backend and every other page stay untouched.

## Decisions

| Topic | Choice |
|---|---|
| Hero | Living agent network in 3D (Three.js): agents as glowing nodes, particles carry work between them |
| Look | Dark, scoped to this page only |
| Motion | Fully scripted loop, not driven by logs. A small note says "Animation is illustrative; counts are real" |
| Effects | Agent thought bubbles, counters that count up to real DB totals |
| Layout | Scroll story: hero (full screen), then "One conference, end to end", then links to the live screens |
| Interaction | Hover a node for its role; click it to open its real screen |
| Header | Keep `RoleSelector` as is (photo band); the dark page starts below it |
| Old content | Replaced. The conference links move into the closing section |

## Page outline

1. **Header**: `RoleSelector` with `active="ops"`, unchanged.
2. **Hero** (`min-h-[100dvh]`, dark `#05070d`):
   - Full-bleed Three.js canvas.
   - Top-left overlay: kicker "MiceMax operations", headline "A company run by AI agents", sub "19 agents run every conference. 1 human checks their work."
   - Bottom overlay: counter row (see Counters).
   - Small note bottom-right: illustrative animation, real counts.
3. **One conference, end to end**: a vertical timeline of 8 beats. A glowing line fills as you scroll; each beat fades in (IntersectionObserver plus CSS). Each beat has the agent name and colour, a time label, one sentence and a link to its real screen.
4. **Try it live**: three large link cards (`/ops/run` "Paste a conference URL", `/ops/sales`, `/ops/JADM32` "Snow disruption and voice booking"), plus the list of conferences linking to `/ops/:conf` (same data as today: `opsConferenceIds()`).
5. **Footer**: photo credit, as today.

## The 3D hero

Three.js with `EffectComposer` + `UnrealBloomPass` and `CSS2DRenderer` for labels and bubbles (all from `three/addons`).

- **Nodes**: the 19 agents from `backend/app/ai/control.py` `AGENTS`, plus one distinct **human** node (warm white, larger, near the centre). The four departments sit as clusters in 3D space: Setup (9 nodes, a chain), Operations (7), Growth (1), Reporting (2). One colour per department, emissive spheres with a soft glow sprite. `city-report` (mode "next") is dimmer.
- **Edges**: faint curved lines (CatmullRom) along the work flow: the setup chain 1→9, writer→mailer and booker and concierge, operations→reporter→city-report, reporter→sales, sales→reader (the loop closes: sales finds the next conference).
- **Script loop (~40 s, repeats)**:
  1. A comet labelled with a conference URL flies in from off-screen to `reader`.
  2. A bright pulse runs down the setup chain; each node flashes and shows a bubble as the pulse arrives.
  3. `writer` fans out: a burst of many small particles to `mailer` (emails), a ring pulse with a short waveform at `booker` (call), back-and-forth sparks at `concierge` (Q&A).
  4. `replanner` flashes amber with a snow bubble, then reroutes particles.
  5. One spark goes from `concierge` to the **human** ("Handed to a person: refund question"), which glows once.
  6. Particles flow to `reporter` → `city-report`, then `sales` sends a comet back to `reader` with a new conference name. Loop.
  - Throughout, faint ambient particles drift along all edges so the scene never looks idle.
- **Bubbles**: short JA/EN lines over the active node, typewriter-in, fade after ~2.5 s, at most 3 on screen. Use real names: JADM32, Jozankei, Makomanai shuttle, Mt Moiwa, 210 sessions, 15 free windows.
- **Camera**: slow auto-orbit plus mouse parallax. Drag to rotate (OrbitControls, zoom and pan off, so page scroll still works).
- **Hover/click**: raycast on nodes. Hover shows a label (role, tool) and a slight scale-up; click navigates to the agent's `link`.
- **Performance and fallbacks**: cap pixel ratio at 2; pause the render loop when the hero is off-screen or the tab is hidden; fewer particles below 768 px width. `prefers-reduced-motion`: render one still frame, no orbit, no bubbles. If WebGL fails, show the agents as a static grid of links by department.

## Counters (real numbers, animated)

Count up once when the hero loads (ease-out, ~1.5 s), mono font, tabular numbers. Values are computed server-side from SQLite:

| Counter | Source |
|---|---|
| Conferences read | `conferences` (271) |
| Experiences checked | `experiences` (109) |
| Attendee actions handled | `events` (15,737, simulated, so label it simulated) |
| AI agents | 18 active (exclude `city-report`, mode "next") |
| Humans | 1 |

Add the `events` count to `builtCounts()` in `ui/src/components/control/counts.ts`, or move that file into the new folder.

## The 8 timeline beats (JADM32)

| Time | Agent | Beat |
|---|---|---|
| T+0 | reader | Organizer pastes the URL; the site is read |
| T+1 min | scheduler, sorter | 210 sessions extracted and sorted |
| T+2 min | window-finder | 15 free windows found |
| T+3 min | filter | 276 fits across 15 windows; 361 ruled out, each with a reason (e.g. "too long", "too late to start") |
| T+4 min | writer | JA/EN page and email ready for the organizer |
| Weeks before | mailer, group-filler | Emails, reminders, groups nudged |
| 2 days before | booker | Calls the ryokan to book the Makomanai shuttle (voice) |
| Conference day | replanner | Snow stops the Jozankei bus; guests replanned and messaged |
| Day after | reporter | Results go to the city view |

The numbers match the JADM32 setup rows in `agent_steps` (checked). The table has 9 rows; keeping 9 is fine.

## Files

All new code sits in `ops-home` names, so nothing else gets touched.

| File | Owner | What |
|---|---|---|
| `ui/src/data/ops-home.ts` | A (write first) | Agents (id, dept, role en/ja, tool, link), edges, script beats with bubble text en/ja, timeline beats. Typed, no logic |
| `ui/src/scripts/ops-hero/*.ts` | A | Three.js scene: `index.ts` mounts on `#ops-hero`, plus `scene.ts`, `nodes.ts`, `particles.ts`, `script.ts`, `bubbles.ts` as needed |
| `ui/src/pages/ops/index.astro` | B | Rebuilt page shell, hero overlay, counters, timeline, closing links |
| `ui/src/components/ops-home/*.astro` | B | `Hero.astro`, `Counters.astro`, `Timeline.astro`, `TryLive.astro` |
| `ui/src/scripts/ops-home-scroll.ts` | B | Counter count-up, timeline reveal and line fill |
| `ui/src/i18n/features/ops-home.en.json`, `.ja.json` | B | All page strings under `opsHome.*` (full Japanese, not partial) |
| `ui/package.json`, lockfile | A | Add `three` and `@types/three` |

Contract between A and B: B renders `<div id="ops-hero" class="absolute inset-0"></div>` inside the hero; A's script fills it and reads the language from `document.documentElement.lang`. Bubble and label text comes from `ops-home.ts` (en/ja pairs, as in `control.py`), so A needs no i18n keys.

Dark styling stays local: a wrapper class on `<main>` (e.g. `bg-[#05070d] text-slate-100`) plus a `<style>` block in the page. Don't edit `global.css`, `Base.astro` or `RoleSelector.astro`. The rules from AGENTS.md still apply: no separator characters, no coloured status dots.

Remove what only the old page used: `ui/src/scripts/control-room.ts`, `ui/src/components/control/ControlLinks.astro`, `BuiltPanel.astro`. Leave the `control.*` i18n keys and `/api/ops/agents` in place, since other people may be working near them.

## Order

1. A writes `ops-home.ts` and adds `three` (~5 min); B can start the shell at the same time against the contract above.
2. A builds the scene, nodes, edges and ambient particles, then the script loop, then bubbles and hover/click, then the fallbacks.
3. B builds the shell, hero overlay, counters, timeline and closing section, then the JA strings.
4. Together: tune the colours and bloom on a big screen, then verify.

## Verify

- `npm run build` and `npx astro check` pass.
- Screenshot `/ops` at 1920×1080 and 390×844, in EN and JA (Playwright). The hero is moving, labels are readable, there are no console errors.
- Clicking a node opens its screen. Reduced motion shows a still frame.
- `git diff --stat` touches only the files listed above.
- Update the `/ops` row in `docs/10-ai-operations-plan.md` and the `/ops` line in `AGENTS.md` to say "company showcase".
