// Beats 1-4 on one long Sapporo street: airport, local places, convention center.
import { C, D, push, pop, group, stroke, seg, bez, hand, prog, ease, easeOut, lerp, clamp, hash, dashed } from './ink.js';
import { person, plane, coin } from './figures.js';
import { airport, onsen, ramen, market, izakaya, moiwa, convention, skyline, clouds, BOARD } from './places.js';
import { schedule } from './schedule.js';

const DOOR = 2060, GATE = 450;
const WIDE = [1330, 512, 0.95], BOARDCAM = [BOARD.x + BOARD.w / 2, 668, 3.2];

// Zoom between two cameras keeping the motion feeling like a zoom toward a point.
function zoomCam(a, b, k) {
  const z = Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), k));
  const w = (1 / a[2] - 1 / z) / (1 / a[2] - 1 / b[2] || 1);
  return [lerp(a[0], b[0], w), lerp(a[1], b[1], w), z];
}
export function streetCam(t) {
  if (t < 4) return [lerp(650, 1750, ease(prog(t, 1.3, 4.2))), 600, 1.35];
  const end1 = [1750, 600, 1.35];
  if (t < 7.5) { const w = [lerp(1330, 1290, prog(t, 5, 7.5)), 512, 0.95]; return zoomCam(end1, w, ease(prog(t, 3.95, 5))); }
  const w2 = [1290, 512, 0.95];
  if (t < 9.4) {
    const c = zoomCam(w2, BOARDCAM, ease(prog(t, 7.45, 8.2)));
    c[2] *= 1 + 0.04 * prog(t, 8.2, 9.4); return c;
  }
  const bc = [BOARDCAM[0], BOARDCAM[1], BOARDCAM[2] * 1.04];
  if (t < 10.4) return zoomCam(bc, WIDE, ease(prog(t, 9.4, 10.35)));
  return [lerp(1330, 1310, prog(t, 10.4, 15)), lerp(512, 530, prog(t, 10.4, 15)), lerp(0.95, 1.0, prog(t, 10.4, 15))];
}

// ---- crowd for beats 1-2: arrive, then turn around and walk back to the plane ----
const N = 44;
const crowd = Array.from({ length: N }, (_, i) => {
  const v = 170 + hash(i, 1) * 60;
  return { v, U: -1.25 * v + (i + hash(i, 2) * 0.8) / N * (1700 + 1.25 * v), lane: 905 + hash(i, 3) * 60,
    shirt: [C.blue, C.red, C.blue, C.gold, C.green][i % 5], caseCol: [C.red, C.blue, C.gold][(i * 7) % 3], seed: i + 1 };
});
function tau(t) {
  if (t < 3.9) return t;
  if (t < 4.25) return 3.9;
  return 3.9 - (t - 4.25) * 1.5;
}
function drawCrowd1(t) {
  const tt = tau(t), moving = t < 3.9 || t > 4.25, dir = t < 4.07 ? 1 : -1;
  crowd.slice().sort((a, b) => a.lane - b.lane).forEach(p => {
    const x = GATE + p.U + p.v * tt;
    const a = clamp((x - GATE) / 50) * clamp((DOOR - x) / 50);
    if (a <= 0) return;
    const hop = t > 3.95 && t < 4.2 ? -Math.sin(prog(t, 3.95, 4.2) * Math.PI) * 10 : 0;
    person(x, p.lane + hop, { dir, ph: (x / 26) + p.seed, walk: moving ? 1 : 0, shirt: p.shirt, case: true, caseCol: p.caseCol, seed: p.seed, a });
  });
}

// ---- crowd for beats 3-4: walk out to local places, then spend ----
const SPOTS = [
  ...[820, 870, 920, 970].map(x => ({ x, shop: 'onsen', sx: 885 })),
  ...[1100, 1150, 1200].map(x => ({ x, shop: 'ramen', sx: 1170 })),
  ...[1245, 1290].map(x => ({ x, shop: 'moiwa', sx: 1260 })),
  ...[1380, 1430, 1480, 1530].map(x => ({ x, shop: 'market', sx: 1460 })),
  ...[1660, 1710, 1760, 1810].map(x => ({ x, shop: 'izakaya', sx: 1745 })),
];
const crowd2 = SPOTS.map((s, i) => {
  const v = 360, exit = 7.6 + i * 0.06;
  return { ...s, v, exit, arrive: exit + (DOOR - s.x) / v, lane: 910 + hash(i, 13) * 50, seed: 60 + i,
    shirt: [C.blue, C.red, C.gold, C.green][i % 4] };
});
const ARRIVE = {};
for (const p of crowd2) ARRIVE[p.shop] = Math.min(ARRIVE[p.shop] ?? 99, p.arrive);

function drawCrowd2(t) {
  crowd2.slice().sort((a, b) => a.lane - b.lane).forEach(p => {
    if (t < p.exit) return;
    const x = Math.max(p.x, DOOR - p.v * (t - p.exit)), here = x <= p.x;
    const a = clamp((DOOR - x) / 50);
    const dir = here ? (p.sx > p.x ? 1 : -1) : -1;
    person(x, p.lane, { dir, ph: x / 26 + p.seed, walk: here ? 0 : 1, shirt: p.shirt, seed: p.seed, a });
  });
  // beat 4: coins fly from people to the places
  if (t > 11.5) crowd2.forEach((p, i) => {
    for (let k = 0; k < 2; k++) {
      const start = Math.max(p.arrive + 0.3, 11.6) + hash(i, 40) * 0.6 + k * 0.55;
      if (t < start) continue;
      const u = ((t - start) / 1.1) % 1, cyc = Math.floor((t - start) / 1.1);
      if (t > 14.7 && cyc > 0) continue;
      const x0 = p.x + (p.sx > p.x ? 20 : -20), y0 = p.lane - 60, x1 = p.sx + (hash(i, k + cyc) - 0.5) * 60, y1 = 860 - 90;
      const x = lerp(x0, x1, u), y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 140;
      coin(x, y, 15, clamp(u * 8) * clamp((1 - u) * 6));
    }
  });
}

export function litOf(shop, t) {
  if (t < 4) return 0;
  if (t < 9) return -ease(prog(t, 4.1, 5.0));
  return -1 + 2 * easeOut(prog(t, ARRIVE[shop], ARRIVE[shop] + 0.6));
}

function ground() {
  group(2900);
  stroke(seg(-500, 870, 3300, 870), { w: 3 });
  stroke(seg(-500, 985, 3300, 985), { w: 2, a: 0.5 });
  for (let i = 0; i < 40; i++) {
    const x = -400 + i * 95 + hash(i, 5) * 40, y = 1010 + hash(i, 6) * 60;
    stroke(seg(x, y, x + 26 + hash(i, 7) * 20, y), { w: 1.8, a: 0.45 });
  }
}

// Planes leaving in beat 2 fly up across the sky; one lands in beat 1.
function skyPlanes(t) {
  if (t < 2.8) {
    const k = easeOut(prog(t, 0.9, 2.6));
    plane(lerp(-700, 120, k), lerp(330, 830, Math.pow(k, 0.8)), 0.7, lerp(0.16, 0, k), 1, 41);
  }
  for (let j = 0; j < 3; j++) {
    const t0 = 4.7 + j * 0.85, k = prog(t, t0, t0 + 2.2);
    if (k <= 0 || k >= 1) continue;
    const e = k * k;
    plane(lerp(600, 3000, e), lerp(840, -150, Math.max(0, e - 0.05) * 1.05), lerp(0.62, 0.42, k), -0.32 * clamp(k * 4), 1, 50 + j);
  }
}

export function street(t, zmul = 1, ax = 960, ay = 540) {
  const [cx, cy, z0] = streetCam(t), z = z0 * zmul;
  push(ax - cx * z, ay - cy * z, z);
  clouds(t);
  skyPlanes(t);
  moiwa(litOf('moiwa', t), t);
  skyline();
  airport();
  onsen(litOf('onsen', t), t); ramen(litOf('ramen', t), t); market(litOf('market', t), t); izakaya(litOf('izakaya', t), t);
  convention();
  schedule(t);
  ground();
  plane(300, 790, 1, 0, 1, 40);
  if (t < 7.9) drawCrowd1(t);
  if (t > 7.9) drawCrowd2(t);
  pop();
}

// Beat 4 counter, in screen space above the street.
export function counter(t) {
  const k = prog(t, 11.75, 12.1);
  if (k <= 0) return;
  const n = Math.round(lerp(33, 170, ease(prog(t, 12.1, 14.1))));
  const pop2 = 1 + 0.06 * Math.max(0, Math.sin(prog(t, 12.1, 14.1) * Math.PI * 14)) * (t < 14.1 ? 1 : 0);
  push(960, 470, pop2 * lerp(0.8, 1, easeOut(k)), 0, k * (1 - prog(t, 14.45, 14.7)));
  hand(`¥${n}M`, 0, 0, 230, 1, { c: C.gold, outline: C.ink, seed: 5 });
  pop();
}
