// Beat 9: the MiceMax logo (ui/public/favicon.svg) draws itself, then the name.
import { C, D, push, pop, group, stroke, hand, glow, prog, ease, easeOut, back } from './ink.js';

let PATH = null, STROKES = [];

export async function loadLogo() {
  const svg = await fetch('./logo.svg').then(r => r.text());
  const d = svg.match(/ d="([^"]+)"/)[1];
  PATH = new Path2D(d);
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.style.cssText = 'position:absolute;width:0;height:0'; host.appendChild(el); document.body.appendChild(host);
  const L = el.getTotalLength();
  let cur = [], prev = null;
  for (let i = 0; i <= 1400; i++) {
    const p = el.getPointAtLength(L * i / 1400), q = [p.x - 64, p.y - 64];
    if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 2.5) { if (cur.length > 8) STROKES.push(cur); cur = []; }
    cur.push(q); prev = q;
  }
  if (cur.length > 8) STROKES.push(cur);
  host.remove();
}

export function logo(t) {
  const s = 3.3 * (0.92 + 0.08 * easeOut(prog(t, 28.55, 29.4)));
  push(960, 440, s);
  group(8001);
  glow(0, 10, 110, C.gold, 0.5 * prog(t, 28.9, 29.5));
  const f = prog(t, 29.0, 29.45);
  if (f > 0) {
    const c = D.F; c.save(); c.translate(-64, -64); c.globalAlpha = f * 0.95; c.fillStyle = C.red; c.fill(PATH); c.restore();
  }
  STROKES.forEach((pts, i) => stroke(pts, { w: 3.4, p: ease(prog(t, 28.6 + i * 0.12, 29.15 + i * 0.12)) }));
  pop();
  hand('MiceMax', 960, 870, 200, prog(t, 29.0, 29.45), { seed: 9 });
}
