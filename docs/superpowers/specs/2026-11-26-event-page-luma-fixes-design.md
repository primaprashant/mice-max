# Event page Luma-style fixes — design

Date: 2026-11-26. Branch: `event-page-fixes`.

## Intent

The experience page (`/c/<conf>/e/<exp>`, for example `/c/icep2027/e/xn-the-windsor-hotel-toya`) takes three patterns from the Luma event page reference (luma.com/resonanzdaylight_vol1):

1. The book button hovers on the right edge of the viewport and is sticky (always visible).
2. Location and price are highlighted as separate components with icons.
3. An attending counter (capacity) at the very top of the page.

## Approaches considered

1. Full Luma rebuild of the page (hero, about text, no grid). Rejected: the page's job is booking one experience, not selling a conference; a rebuild drops the demo flow.
2. Targeted components on the existing page (chosen): add the three Luma patterns, keep the rest of the page as is.

## Decisions the user made

- Capacity comes only from real demo data: the `headlines` table (8 headline experiences, one per kind, people range stored). Pages with a headline row show "X of Y attending" plus the simulated label; pages without one (the Windsor page included) show only "X attending" from the event log, no cap.
- The sticky book button is a floating pill on the right edge, replacing the sticky bottom block (removed, not kept twice).
- The attending figure counts the same joined rows as the existing "Who is going" card, so both numbers agree.

## Constraints

- Theme tokens only, both i18n files updated in the same edit, no separator characters, AA contrast, honest button semantics.
- The counter cap is simulated data only where it comes from `headlines`; it carries the `SimulatedLabel`.

## Left to the builder

- The place name for the location card comes from `places` through the experience's first stop; long plan names are shown up to the colon.
- Serving: Astro dev on port 4322 with `PUBLIC_API_BASE=http://localhost:8002`, FastAPI on 8002 with `CORS_ORIGINS` for 4322.
