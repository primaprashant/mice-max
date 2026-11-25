/** Runtime z-index resolution for calendar blocks. No hardcoded event
 * layers: every rendered block starts equal, and this walks the DOM,
 * measures real geometry, and assigns stacking by overlap depth, then by
 * duration (shorter blocks above longer ones, so a short session's title
 * stays readable over a long plan band). Re-runs on resize.
 * Blocks never ride over the sticky chrome: the runtime value is capped at
 * MAX_BLOCK_Z, and the sticky layers sit above it (headers 300, gutter 400,
 * tab bar and now-line 500). Blocks hide behind the sticky bar on scroll. */
const DEPTH_STEP = 10;
const MAX_BLOCK_Z = 200;

function zIndexFor(depth: number, durationPx: number): number {
  return Math.min(1 + depth * DEPTH_STEP + Math.round(Math.max(0, 60 - durationPx / 10)), MAX_BLOCK_Z);
}

function resolve(root: ParentNode) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[style*='top:'][style*='height:']"))
    .filter((el) => el.offsetParent !== null || el.style.top !== "");
  for (const el of blocks) {
    const rect = el.getBoundingClientRect();
    el.dataset.zDuration = String(rect.height);
  }
  for (const a of blocks) {
    const ra = a.getBoundingClientRect();
    let depth = 0;
    for (const b of blocks) {
      if (a === b) continue;
      const rb = b.getBoundingClientRect();
      const overlaps = ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1 && ra.left < rb.right - 1 && rb.left < ra.right - 1;
      if (overlaps) depth++;
    }
    const durationPx = Number(a.dataset.zDuration ?? 0);
    a.style.zIndex = String(zIndexFor(depth, durationPx));
  }
}

function init() {
  const resolveAll = () => {
    for (const grid of document.querySelectorAll<HTMLElement>("[data-day-grid]")) resolve(grid);
  };
  resolveAll();
  // Plans upgrade before this module attaches its listener, so their
  // blocks-changed event is missed; re-run after the current task and once
  // more after layout settles to cover the race.
  requestAnimationFrame(resolveAll);
  window.setTimeout(resolveAll, 200);
  document.addEventListener("micemax:blocks-changed", resolveAll);
  let timer: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = window.setTimeout(resolveAll, 150);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
