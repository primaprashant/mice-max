// Beat 7: city hall pays for one program card, written slowly by hand.
import { C, D, push, pop, group, stroke, seg, arc, circle, rectP, rrect, bez, dot, wash, washRect, washCircle, glow, prog, ease, easeOut, lerp, clamp, hash } from './ink.js';
import { note } from './figures.js';

export const CARD = { x: 1000, y: 650, w: 560, h: 380, rot: -0.035 };
const T0 = 22.35, T1 = 25.4;          // writing window

function cityHall() {
  group(6001);
  const x = 160, w = 360, B = 920;
  wash([[x, B], [x, B - 230], [x + w, B - 230], [x + w, B]], C.cream, { a: 0.9 });
  wash([[x - 20, B - 230], [x + w / 2, B - 320], [x + w + 20, B - 230]], C.blue, { a: 0.85 });
  stroke([[x - 20, B - 230], [x + w / 2, B - 320], [x + w + 20, B - 230], [x - 20, B - 230]], { w: 3.2 });
  for (let i = 0; i < 5; i++) { const cx = x + 40 + i * 70; stroke(seg(cx, B - 220, cx, B - 20), { w: 3 }); stroke(seg(cx + 18, B - 220, cx + 18, B - 20), { w: 2 }); }
  stroke(rectP(x - 10, B - 20, w + 20, 20), { w: 3 });
  stroke(seg(x - 40, B, x + w + 40, B), { w: 3 });
  stroke(seg(x + w / 2, B - 320, x + w / 2, B - 400), { w: 2.6 });
  washRect(x + w / 2, B - 400, 60, 40, C.cream, { a: 1 }); stroke(rectP(x + w / 2, B - 400, 60, 40), { w: 2.4 });
  washCircle(x + w / 2 + 30, B - 380, 11, C.red, { a: 1 });
}

function clock(t) {
  group(6101);
  const x = 1700, y = 640, r = 80;
  washCircle(x, y, r, C.cream, { a: 1 });
  stroke(circle(x, y, r), { w: 3.4 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; stroke(seg(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92), { w: 2.2 }); }
  const m = (t - 22) * 9, h = m / 12;
  stroke(seg(x, y, x + Math.cos(m - 1.57) * r * 0.75, y + Math.sin(m - 1.57) * r * 0.75), { w: 3 });
  stroke(seg(x, y, x + Math.cos(h - 1.57) * r * 0.5, y + Math.sin(h - 1.57) * r * 0.5), { w: 4.4, c: C.red });
  dot(x, y, 6);
  stroke(arc(x, y, r + 22, r + 22, -2.2, -1.2), { w: 2.4, a: 0.6 }); stroke(arc(x, y, r + 22, r + 22, -0.6, 0.3), { w: 2.4, a: 0.6 });
}

// Writing steps on the card (card-local units, origin at the card center).
const C2 = CARD;
const WRITE = (() => {
  const L = [];
  const hw = C2.w / 2, hh = C2.h / 2;
  L.push(bez([-hw + 50, -hh + 90], [-hw + 70, -hh + 40], [-hw + 140, -hh + 40], [-hw + 160, -hh + 90]));   // mini convention roof
  L.push([[-hw + 50, -hh + 90], [-hw + 160, -hh + 90], [-hw + 160, -hh + 130], [-hw + 50, -hh + 130], [-hw + 50, -hh + 90]]);
  const wl = (x, y, len, amp = 7) => { const o = []; for (let i = 0; i <= len; i += 6) o.push([x + i, y + Math.sin(i * 0.09) * amp + Math.sin(i * 0.23) * 3]); return o; };
  L.push(wl(-hw + 190, -hh + 90, 300, 9));
  L.push(wl(-hw + 50, -hh + 190, 440));
  L.push(wl(-hw + 50, -hh + 240, 380));
  L.push(wl(-hw + 50, -hh + 290, 420));
  L.push(wl(-hw + 50, -hh + 340, 200));
  return L;
})();
const LEN = WRITE.map(l => l.reduce((s, p, i) => i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0));
const TOTAL = LEN.reduce((a, b) => a + b, 0);

// card contents written up to fraction k; returns pen tip (card-local).
export function cardContents(k, still = false) {
  let left = k * TOTAL, tip = WRITE[0][0];
  WRITE.forEach((l, i) => {
    const p = clamp(left / LEN[i]);
    if (p > 0) {
      stroke(l, { w: i < 2 ? 3 : 2.6, p, c: i < 3 ? C.ink : C.blue, still });
      const idx = Math.min(l.length - 1, Math.floor(p * (l.length - 1))); if (p < 1 || i === WRITE.length - 1) tip = l[idx];
      if (p >= 1 && i === 1) washRect(-C2.w / 2 + 50, -C2.h / 2 + 90, 110, 40, C.blue, { a: 0.6, still });
    }
    left -= LEN[i];
  });
  return tip;
}
export function cardFrame(still = false) {
  wash([[-C2.w / 2, -C2.h / 2], [C2.w / 2, -C2.h / 2], [C2.w / 2, C2.h / 2], [-C2.w / 2, C2.h / 2]], C.cream, { a: 1, still });
  stroke(rectP(-C2.w / 2, -C2.h / 2, C2.w, C2.h), { w: 3.4, still });
  stroke(rectP(-C2.w / 2 + 16, -C2.h / 2 + 16, C2.w - 32, C2.h - 32), { w: 1.6, c: C.red, a: 0.8, still });
}
// slow, halting pen progress (stops and restarts)
const penK = t => { const u = prog(t, T0, T1); return clamp(u * 0.8 + Math.sin(u * 26) * 0.015 - 0.01); };

function handPencil(x, y, t) {
  const wig = Math.sin(t * 30) * 2.5;
  push(x, y + wig, 1.35, -0.62); group(6201);
  // sleeve
  wash([[150, -46], [330, -80], [330, 60], [150, 40]], C.blue, { a: 0.85 });
  stroke(seg(150, -46, 330, -80), { w: 3 }); stroke(seg(150, 40, 330, 60), { w: 3 });
  stroke(bez([150, -46], [140, -20], [140, 20], [150, 40]), { w: 3 });
  // pencil
  wash([[0, 0], [20, -11], [200, -11], [200, 11], [20, 11]], C.gold, { a: 0.95 });
  stroke([[0, 0], [20, -11], [200, -11], [200, 11], [20, 11], [0, 0]], { w: 2.8 });
  stroke(seg(20, 0, 200, 0), { w: 1.4, a: 0.6 });
  washRect(200, -11, 24, 22, C.red, { a: 0.9 }); stroke(rectP(200, -11, 24, 22), { w: 2.6 });
  dot(3, 0, 4);
  // fist around the pencil
  const palm = arcPts(118, -6, 50, 40);
  wash(palm, C.skin, { a: 0.9 }); stroke(palm, { w: 3.2 });
  for (let i = 0; i < 3; i++) {
    const fx = 84 + i * 24;
    wash(arcPts(fx, 22, 14, 12), C.skin, { a: 0.9 }); stroke(arc(fx, 22, 14, 12, -0.2, Math.PI + 0.2), { w: 2.6 });
  }
  stroke(bez([70, -14], [60, -40], [90, -46], [112, -24]), { w: 3 });
  pop();
}
const arcPts = (cx, cy, rx, ry) => arc(cx, cy, rx, ry, 0, Math.PI * 2);

function paperBall(x, y, s, seed) {
  push(x, y, s); group(6300 + seed);
  washCircle(0, 0, 26, C.cream, { a: 1 });
  const pts = []; for (let q = 0; q <= 34; q++) { const a = q * 0.37 + seed; const r = 26 - q * 0.45 + 5 * Math.sin(q * 1.7 + seed); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]); }
  stroke(pts, { w: 2.4 });
  stroke([[-14, -6], [-4, 2], [6, -8], [14, 4]], { w: 1.8, a: 0.7 });
  pop();
}

export function city(t, rest = true, card = true) {
  if (rest) {
    cityHall();
    clock(t);
    // notes travel from city hall to beside the card, then stack up
    for (let i = 0; i < 6; i++) {
      const t0 = 22.4 + i * 0.42, k = ease(prog(t, t0, t0 + 0.6));
      if (t < t0) continue;
      const x = lerp(420, 640, k), y = lerp(640, 895 - i * 14, k) - Math.sin(k * Math.PI) * 180;
      note(x, y, 1.3, lerp(-0.6, 0.06 * (i % 2 ? 1 : -1), k));
    }
    // crumpled attempts tossed onto the floor
    [[23.1, 1360, 905], [23.85, 1480, 920], [24.6, 1420, 960], [25.1, 1560, 950]].forEach(([t0, x, y], i) => {
      const k = prog(t, t0, t0 + 0.45); if (k <= 0) return;
      paperBall(lerp(1150, x, k), lerp(600, y, k) - Math.sin(k * Math.PI) * 160, 1.6, i);
    });
  }
  if (!card) return;
  push(CARD.x, CARD.y, 1, CARD.rot);
  cardFrame();
  const tip = cardContents(penK(t));
  pop();
  if (rest) {
    const c = Math.cos(CARD.rot), s = Math.sin(CARD.rot);
    handPencil(CARD.x + tip[0] * c - tip[1] * s, CARD.y + tip[0] * s + tip[1] * c, t);
  }
}
export const cardProgress = penK;
