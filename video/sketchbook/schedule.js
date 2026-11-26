// Conference program on the convention-center board. Local units 1600x900.
// Gaps in the program turn into onsen, ramen and a night view during beat 3.
import { C, push, pop, group, stroke, seg, rectP, circle, wash, washRect, glow, prog, easeOut, dashed, hash } from './ink.js';
import { onsenIcon, ramenIcon, nightIcon } from './figures.js';
import { BOARD } from './places.js';

const col = d => 90 + d * 490, W = 440, hy = h => 70 + (h - 9) * 63;
const DAYS = [
  [[9, 10.5], [10.5, 12], [12, 13], [13, 15], [15, 17], ['onsen', 17, 21]],
  [[9, 10.5], [10.5, 11.75], ['ramen', 11.75, 14.25], [14.25, 15.75], [15.75, 17], ['night', 17, 21]],
  [[9, 11], [11, 13], [13, 14.5], [14.5, 17], [17, 19], [19, 21]],
];
// When each gap gets filled.
const FILL = { onsen: 8.25, ramen: 8.7, night: 9.15 };

export function schedule(t) {
  const b = BOARD;
  push(b.x, b.y, b.w / 1600);
  group(3001);
  DAYS.forEach((day, d) => {
    const x = col(d);
    stroke(seg(x, 34, x + W, 34), { w: 6 });
    day.forEach((s, i) => {
      group(3100 + d * 20 + i);
      if (typeof s[0] === 'number') {
        const y = hy(s[0]) + 6, h = hy(s[1]) - hy(s[0]) - 12;
        washRect(x, y, W, h, (d + i) % 3 === 0 ? C.red : C.blue, { a: 0.55 });
        stroke(rectP(x, y, W, h), { w: 2.6 });
        const lines = Math.max(1, Math.min(3, Math.floor(h / 34)));
        for (let k = 0; k < lines; k++) {
          const len = 140 + hash(d * 9 + i, k) * 200, ly = y + 26 + k * 28;
          if (ly < y + h - 10) stroke(wavy(x + 24, ly, len), { w: 2.2, a: 0.7 });
        }
      } else {
        const [kind, h0, h1] = s, y = hy(h0) + 6, h = hy(h1) - hy(h0) - 12;
        const f = prog(t, FILL[kind], FILL[kind] + 0.45);
        if (f <= 0) { dashed(rectP(x, y, W, h), 18, 12, { w: 2.4 }); return; }
        washRect(x, y, W, h, C.gold, { a: 0.75 * f });
        stroke(rectP(x, y, W, h), { w: 3, p: f * 1.5 });
        const cx = x + W / 2, cy = y + h / 2 + 10, s0 = Math.min(1.25, h / 200);
        stroke(circle(cx, cy - 6, W * 0.56, h * 0.62), { w: 4, c: C.red, p: f * 1.4 });
        if (kind === 'onsen') onsenIcon(cx, cy + 10, s0, f);
        if (kind === 'ramen') ramenIcon(cx, cy + 4, s0 * 0.95, f);
        if (kind === 'night') nightIcon(cx, cy, s0, f);
      }
    });
  });
  pop();
}

function wavy(x, y, len) {
  const out = [];
  for (let i = 0; i <= len; i += 8) out.push([x + i, y + Math.sin(i * 0.12) * 4]);
  return out;
}
