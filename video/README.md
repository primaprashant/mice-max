# Intro video

30-second three.js intro for the demo video. Each direction is its own folder and renders to `out/<folder>.mp4` (1920x1080, 60fps, silent).

| Folder | Direction |
|---|---|
| `sketchbook/` | Hand-drawn ink on paper |
| `snowglobe/` | Story inside a Sapporo snow globe |
| `diorama/` | Floating low-poly Hokkaido, tilt-shift |

```sh
npm install                                   # also: npx playwright install chromium
node shared/serve.mjs                         # preview at http://localhost:8100/<folder>/
node shared/render.mjs <folder> --stills 2,9  # PNG stills in out/<folder>-stills/
node shared/render.mjs <folder>               # full MP4 (several minutes)
node shared/render.mjs <folder> --jobs 12     # same, split across 12 parallel browsers
```

## Page contract

`<folder>/index.html` must:
- set `window.ready` to a promise that resolves when assets are loaded;
- define `window.renderAt(t)` that draws the frame at `t` seconds synchronously, canvas and DOM text included. It must depend only on `t` (seeded randomness, no clocks), so frames can render in any order;
- play in real time when opened without `?render`, for previewing.

The renderer screenshots the whole page, so text can be HTML over the canvas.

## Shared

- `shared/timeline.json`: beats, timings and the header text for each.
- `shared/geo/`: `hokkaido.json` and `japan.json` outlines (lon/lat rings), `places.json` points.
- `shared/fonts/`: Geist (UI font), Caveat (handwriting), Fredoka (rounded).
- Import map: `three` is `/node_modules/three/build/three.module.js`, addons under `/node_modules/three/examples/jsm/`.
- Logo: `../ui/public/favicon.svg` (copy it into your folder).
