// Hokkaido and Japan maps from shared/geo, in map units (lon * cos 43deg, -lat).
import { C, D, push, pop, group, stroke, wash, dot, glow, circle, bez, dashed, prog, ease, easeOut, lerp, clamp, hash } from './ink.js';
import { plane } from './figures.js';

const COS = Math.cos(43 * Math.PI / 180);
export const mp = ([lon, lat]) => [lon * COS, -lat];
let HOK = [], JAP = [], PL = {};

export async function loadMaps() {
  const [h, j, p] = await Promise.all(['hokkaido', 'japan', 'places'].map(n => fetch(`../shared/geo/${n}.json`).then(r => r.json())));
  HOK = h.rings.map(r => r.map(mp)).sort((a, b) => b.length - a.length);
  JAP = j.prefectures.filter(q => q.name !== 'Hokkai Do').flatMap(q => q.rings.map(r => r.map(mp)));
  PL = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, mp(v)]));
  Object.assign(PL, Object.fromEntries(Object.entries(EXTRA).map(([k, v]) => [k, mp(v)])));
}
const EXTRA = { Sendai: [140.87, 38.27], Niigata: [139.04, 37.92], Nagoya: [136.91, 35.18], Kyoto: [135.77, 35.01],
  Hiroshima: [132.46, 34.39], Kanazawa: [136.65, 36.56], Kagoshima: [130.56, 31.6], Matsuyama: [132.77, 33.84],
  Aomori: [140.74, 40.82], Kumamoto: [130.74, 32.8], Shizuoka: [138.38, 34.98], Okayama: [133.93, 34.66], Morioka: [141.15, 39.7] };
export const place = n => PL[n];

// Map camera: map point (mx, my) at screen (sx, sy), K pixels per unit.
export function mapPush(mx, my, K, sx, sy, a = 1) { push(sx - mx * K, sy - my * K, K, 0, a); }

export function hokkaido(p = 1, washA = 0.4) {
  group(5001);
  HOK.forEach((r, i) => {
    wash(r, C.gold, { a: washA * clamp(p * 2 - 0.6), still: true, occ: false });
    stroke(r, { w: i === 0 ? 3.4 : 2.4, p: clamp(p * 1.15 - i * 0.04) });
  });
}
export function japan(p = 1, a = 1) {
  group(5101);
  JAP.forEach((r, i) => {
    wash(r, C.gold, { a: 0.3 * a, still: true, occ: false });
    stroke(r, { w: 1.8, p, a: a * 0.85, wob: 0.8 });
  });
}

// A pin for a lit-up city: glow, ring, dot. r in screen px.
export function cityLight(m, k, r = 14, col = C.red) {
  if (k <= 0) return;
  const s = 1 / D.sc, e = easeOut(clamp(k * 1.5));
  glow(m[0], m[1], r * 4 * s * e, C.gold, 0.8);
  dot(m[0], m[1], r * 0.55 * s * e, { c: col });
  if (k < 1) stroke(circle(m[0], m[1], r * s * (1 + 2.5 * k)), { w: 3, a: 1 - k, c: col });
  stroke(circle(m[0], m[1], r * s * e), { w: 3 });
}

// Beat 1 opener: Hokkaido draws on, planes converge on Sapporo, camera dives in.
const ROUTES = [[[136.6, 40.2], 0.1], [[138.6, 39.1], 0.28], [[139.0, 45.2], 0.42], [[144.6, 40.2], 0.2], [[145.3, 44.9], 0.5]];
export function introMap(t) {
  const sap = PL['Sapporo'];
  const dive = ease(prog(t, 1.0, 1.75));
  const K = 175 * (1 + 0.25 * prog(t, 0, 1.0)) * Math.pow(30, dive);
  const c0 = mp([142.75, 43.4]);
  const mx = lerp(c0[0], sap[0], ease(prog(t, 0.8, 1.6))), my = lerp(c0[1], sap[1], ease(prog(t, 0.8, 1.6)));
  const a = 1 - prog(t, 1.1, 1.42);
  const sy = lerp(650, 540, ease(prog(t, 0.8, 1.6)));
  mapPush(mx, my, K, 960, sy, a);
  hokkaido(prog(t, 0, 0.85));
  ROUTES.forEach(([o, t0], i) => {
    const s = mp(o), k = easeOut(prog(t, t0, t0 + 0.85));
    if (k <= 0) return;
    const mid = [(s[0] + sap[0]) / 2 + (i % 2 ? 0.6 : -0.6), (s[1] + sap[1]) / 2 - 0.5];
    const pt = u => { const v = 1 - u; return [v * v * s[0] + 2 * v * u * mid[0] + u * u * sap[0], v * v * s[1] + 2 * v * u * mid[1] + u * u * sap[1]]; };
    const trail = []; for (let q = 0; q <= 40; q++) trail.push(pt(q / 40 * k));
    dashed(trail, 12, 9, { w: 2.4, c: C.blue, a: 0.8 });
    if (k < 0.98) {
      const p1 = pt(k), p2 = pt(Math.min(1, k + 0.02));
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], ps = 0.22 / D.sc;
      if (dx >= 0) plane(p1[0], p1[1], ps, Math.atan2(dy, dx), clamp((1 - k) * 8), 70 + i);
      else plane(p1[0], p1[1], [-ps, ps], Math.atan2(-dy, -dx), clamp((1 - k) * 8), 70 + i);
    }
  });
  cityLight(sap, prog(t, 0.55, 1.2), 18);
  pop();
  return { K, mx, my, sy, sap };
}
