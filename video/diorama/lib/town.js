// The Sapporo diorama: where every toy building sits. Beats look places up here.
import * as THREE from 'three';
import * as P from './props.js';
import { buildTrees } from './terrain.js';
import { rng } from './util.js';

export const SPOT = {
  conv: [-0.6, 0.6], tower: [-1.8, -0.4], hall: [1.0, -0.7], moiwa: [-5.3, 0.7], ryokan: [-3.5, 2.3],
  yatai: [-1.9, 2.75], runway: [5.6, 2.4], parked: [3.7, 3.25],
};
// Road from the parked plane's stairs to the convention center door.
export const ROAD = [[3.5, 3.75], [2.3, 3.45], [0.9, 2.5], [-0.6, 1.45], [-0.6, 1.0]];
export const SHOPS = [[2.75, 3.05, 0.25], [2.05, 2.65, 0.55], [1.35, 2.1, 0.6], [1.7, 3.55, 0.5 + Math.PI], [0.75, 3.05, 0.6 + Math.PI]];
export const VENUES = [[3.0, 0.3], [3.2, -2.6], [0.2, -2.0], [2.6, -0.9], [-1.0, -1.8], [3.6, 0.8], [1.0, 4.4], [1.9, -2.4], [-3.0, -2.6], [4.4, -1.6], [0.0, 4.6], [-4.6, -2.4]];

const at = (o, [x, z], r = 0) => { o.position.set(x, 0, z); o.rotation.y = r; return o; };

// Arc-length sampler over a polyline of [x, z].
export function pathAt(pts, k) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, k)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const u = Math.min(1, d / seg[i]), a = pts[i], b = pts[i + 1];
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], b[1] - a[1])];
    }
    d -= seg[i];
  }
}

function strip(a, b, w, color, y = 0.004) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = P.box(w, 0.006, len + w, color, (a[0] + b[0]) / 2, y - 0.006, (a[1] + b[1]) / 2);
  m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); m.castShadow = false; return m;
}

export function buildTown() {
  const g = new THREE.Group(), T = { group: g };
  T.conv = at(P.conventionCenter(), SPOT.conv); g.add(T.conv);
  T.tower = at(P.tvTower(), SPOT.tower); g.add(T.tower);
  T.hall = at(P.cityHall(), SPOT.hall); g.add(T.hall);
  T.ryokan = at(P.ryokan(), SPOT.ryokan, 0.3); T.ryokan.scale.setScalar(1.25); g.add(T.ryokan);
  T.yatai = at(P.yatai(), SPOT.yatai, 0.2); T.yatai.scale.setScalar(0.75); g.add(T.yatai);
  T.airport = at(P.airport(), SPOT.runway); g.add(T.airport);
  T.shops = SHOPS.map(([x, z, r], i) => at(P.shop(['#f7e7d0', '#e3eef7', '#fbe1dc', '#e7f0dc', '#f1ebf7'][i], i), [x, z], r));
  T.shops.forEach(s => g.add(s));
  T.venues = VENUES.map(([x, z], i) => at(P.venue(['#d3deec', '#ecdcc8', '#cfe5de', '#e2d8ee'][i % 4], 0.45 + (i % 3) * 0.2, i), [x, z], (i % 4) * 0.3 - 0.4));
  T.venues.forEach(v => g.add(v));

  // Mt Moiwa: a big low-poly hill with a snowy crown and a lit summit deck.
  const hill = new THREE.ConeGeometry(1.35, 1.6, 9, 3); hill.translate(0, 0.8, 0);
  const hp = hill.attributes.position, R = rng(9);
  for (let i = 0; i < hp.count; i++) if (hp.getY(i) > 0.02 && hp.getY(i) < 1.59) { hp.setX(i, hp.getX(i) * (0.85 + R() * 0.3)); hp.setZ(i, hp.getZ(i) * (0.85 + R() * 0.3)); }
  T.moiwa = new THREE.Group(); at(T.moiwa, SPOT.moiwa);
  T.moiwa.add(P.mesh(hill.toNonIndexed(), P.mat(0x86b48a, { flatShading: true })));
  const crown = P.mesh(new THREE.ConeGeometry(0.58, 0.68, 9), P.mat(0xf7f9fc, { flatShading: true }), 0, 1.27, 0); T.moiwa.add(crown);
  T.moiwa.deck = P.litMat(0xd9dde3, 0xffd27a);
  T.moiwa.add(P.box(0.34, 0.08, 0.24, T.moiwa.deck, 0, 1.58, 0));
  g.add(T.moiwa);

  // Roads: main road, a few streets, Odori park strip.
  for (let i = 0; i < ROAD.length - 1; i++) g.add(strip(ROAD[i], ROAD[i + 1], 0.32, 0xcfd5dd));
  for (const [a, b] of [[[-5, -1.5], [5, -1.5]], [[-5, 1.6], [0.3, 1.6]], [[0.3, -3], [0.3, 1.6]], [[-2.4, -3], [-2.4, 4]], [[2.3, -3], [2.3, 1.4]]])
    g.add(strip(a, b, 0.16, 0xd9dee4));
  g.add(strip([-4.8, -0.15], [-0.2, -0.15], 0.3, 0x9ccf8a, 0.006));
  // River.
  g.add(strip([-5.5, 4.6], [-1.2, 3.4], 0.24, 0x9ed2ea, 0.003)); g.add(strip([-1.2, 3.4], [1.4, 5.4], 0.24, 0x9ed2ea, 0.003));

  // Filler houses and trees, kept clear of the landmarks and roads.
  const busy = [...Object.values(SPOT).map(p => [...p, 1.05]), ...VENUES.map(p => [...p, 0.55]), ...SHOPS.map(p => [p[0], p[1], 0.45]),
    ...ROAD.map(p => [...p, 0.7]), [1.6, 3.1, 0.8], [-0.1, 2.0, 0.8], [1.3, 0.5, 1.2], [SPOT.moiwa[0], SPOT.moiwa[1], 1.6], [4.2, 2.6, 1.0], [3.7, 3.3, 0.7]];
  const free = (x, z, pad) => !(x > 2.2 - pad && x < 9 + pad && z > 0.9 - pad && z < 3.85 + pad) && busy.every(([bx, bz, r]) => Math.hypot(x - bx, z - bz) > r + pad);
  const hs = [], ts = [], Q = rng(21);
  for (let i = 0; i < 900 && hs.length < 170; i++) {
    const x = -6 + Q() * 11, z = -3.6 + Q() * 8.6;
    if (Math.abs(z + 1.5) < 0.18 || Math.abs(x - 0.3) < 0.18 || Math.abs(x + 2.4) < 0.18) continue;
    if (free(x, z, 0.2) && hs.every(h => Math.hypot(h[0] - x, h[1] - z) > 0.3)) hs.push([x, z, Math.round(Q() * 2) * Math.PI / 2 + (Q() - 0.5) * 0.2, 0.85 + Q() * 0.4, Math.floor(Q() * 15)]);
  }
  for (let i = 0; i < 1400 && ts.length < 220; i++) {
    const x = -8 + Q() * 17, z = -4.5 + Q() * 11;
    if (free(x, z, 0.12) && hs.every(h => Math.hypot(h[0] - x, h[1] - z) > 0.28)) ts.push([x, z, 0.22 + Q() * 0.16]);
  }
  // Forest behind the ryokan (Jozankei valley).
  for (let i = 0; i < 40; i++) { const a = Q() * 6.28, r = 1.1 + Q() * 1.2; const x = SPOT.ryokan[0] + Math.cos(a) * r - 0.3, z = SPOT.ryokan[1] + Math.sin(a) * r * 0.8 - 0.5; if (z < SPOT.ryokan[1] - 0.3) ts.push([x, z, 0.25 + Q() * 0.2]); }
  T.houses = P.houses(hs); g.add(T.houses);
  g.add(buildTrees(ts));
  return T;
}
