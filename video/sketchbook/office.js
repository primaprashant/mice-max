// Beats 5-6: a busy 17-person org chart, then 15 of them become AI agents around 2 relaxed people.
import { C, D, push, pop, group, stroke, seg, arc, circle, rectP, rrect, bez, dot, wash, washRect, washCircle, glow, prog, ease, easeOut, back, lerp, clamp, hash } from './ink.js';
import { agent, steam } from './figures.js';

const MGR = [330, 750, 1170, 1590], S = 1.25, Y0 = 440, Y1 = 690, Y2 = 985;
const STAFF = [
  { x: 960, y: Y0, role: 0 },
  ...MGR.map(x => ({ x, y: Y1, role: 1 })),
  ...MGR.flatMap(m => [m - 140, m, m + 140].map(x => ({ x, y: Y2, role: 2 }))),
].map((s, i) => ({ ...s, i, prop: i % 3 }));
const KEEP = [0, 2];                       // these two stay human
const SEATS = [[1085, 790], [835, 790]], RC = [960, 700];
const RING = [[350, 140, 6, 0.55], [640, 260, 9, -0.38]];   // rx, ry, count, speed
const agentsList = STAFF.filter(s => !KEEP.includes(s.i)).map((s, k) => {
  const r = k < 6 ? 0 : 1, j = r ? k - 6 : k;
  return { ...s, ring: r, a0: j / RING[r][2] * Math.PI * 2 + r * 0.3, tf: 18.6 + hash(k, 21) * 0.5 };
});

// Stressed worker behind a desk. Feet line at y.
function busy(x, y, s, i, t, a) {
  const shake = (hash(i, D.bf) - 0.5) * 4;
  push(x + shake, y, s, 0, a); group(4000 + i * 13);
  const prop = STAFF[i].prop;
  // body and head
  wash([[-22, -62], [22, -62], [26, -36], [-26, -36]], i === 0 ? C.red : C.blue, { a: 0.8 });
  stroke([[-26, -36], [-22, -62], [22, -62], [26, -36]], { w: 2.8 });
  washCircle(0, -92, 27, C.skin, { a: 0.55 });
  stroke(circle(0, -92, 28, 29), { w: 3 });
  stroke(arc(0, -95, 28, 26, Math.PI * 1.1, Math.PI * 1.9), { w: 5 });
  // worried face: brows up, small o mouth
  stroke(seg(-14, -104, -5, -100), { w: 2.2 }); stroke(seg(14, -104, 5, -100), { w: 2.2 });
  dot(-9, -94, 2.6); dot(9, -94, 2.6);
  stroke(circle(0, -78, 4.5, 5.5), { w: 2 });
  // sweat drops
  for (let k = 0; k < 2; k++) {
    const u = ((t * 1.3 + hash(i, k) + k * 0.5) % 1), sx = (k ? 30 : -32), sy = -108 + u * 30;
    wash([[sx, sy - 9], [sx + 5, sy], [sx, sy + 4], [sx - 5, sy]], C.sky, { a: 0.9 * (1 - u) });
    stroke([[sx, sy - 9], [sx + 5, sy], [sx, sy + 4], [sx - 5, sy], [sx, sy - 9]], { w: 1.6, a: 1 - u });
  }
  // stress scribble above head
  const sp = []; for (let k = 0; k < 18; k++) { const q = k * 2.4 + Math.floor(t * 12) * 0.7; sp.push([Math.cos(q) * (10 + (k % 3) * 5), -140 + Math.sin(q * 1.3) * 9]); }
  stroke(sp, { w: 2, a: 0.85 });
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const a0 = -Math.PI / 2 + sx * (0.5 + k * 0.35); stroke(seg(Math.cos(a0) * 38, -96 + Math.sin(a0) * 38, Math.cos(a0) * 50, -96 + Math.sin(a0) * 50), { w: 2.2, c: C.red }); }
  // phone at ear, or arms flailing with papers
  if (prop !== 1) {
    stroke(bez([22, -58], [40, -70], [36, -92], [26, -92]), { w: 3 });
    washRect(22, -106, 12, 26, C.ink, { a: 0.9 }); stroke(rrect(22, -106, 12, 26, 3), { w: 2 });
    const r = Math.sin(t * 40) > 0 ? 1 : 0;
    stroke(arc(28, -94, 18 + r * 4, 18 + r * 4, -1.0, -0.2), { w: 1.8, a: 0.8 });
  } else {
    const fl = Math.sin(t * 14 + i) * 8;
    stroke(seg(22, -58, 38, -92 + fl), { w: 3 });
    push(40, -100 + fl, 1, 0.3); washRect(-10, -12, 20, 26, C.cream, { a: 1 }); stroke(rectP(-10, -12, 20, 26), { w: 2 }); pop();
  }
  stroke(seg(-22, -58, -36, -36), { w: 3 });
  // desk with paper pile
  washRect(-54, -38, 108, 38, C.gold, { a: 0.55 });
  stroke(rectP(-54, -38, 108, 38), { w: 2.8 });
  const pile = 4 + (i % 3) * 2;
  for (let k = 0; k < pile; k++) stroke(seg(-48 + (k % 2) * 3, -42 - k * 5, -20 + (k % 2) * 3, -42 - k * 5), { w: 1.8 });
  // a sheet flying off
  const u = (t * 0.7 + hash(i, 5)) % 1;
  push(-34 - u * 70, -60 - u * 60, 1, u * 5, 1 - u);
  washRect(-8, -10, 16, 20, C.cream, { a: 1 }); stroke(rectP(-8, -10, 16, 20), { w: 1.6 });
  pop();
  pop();
}

// Relaxed person on a lounge chair with a cup. Feet at y.
function relaxed(x, y, s, flip, seed, t, a) {
  push(x, y, [s * flip, s], 0, a); group(4600 + seed);
  wash([[-60, -10], [40, -10], [60, -60], [-40, -20]], C.red, { a: 0.6 });
  stroke([[-60, -10], [40, -10], [62, -64]], { w: 3 });
  stroke(seg(-50, -10, -56, 10), { w: 3 }); stroke(seg(30, -10, 36, 10), { w: 3 });
  // body leaning back
  wash([[-10, -20], [20, -20], [34, -64], [10, -70]], C.blue, { a: 0.8 });
  stroke([[-10, -20], [10, -70], [34, -64], [20, -20]], { w: 2.8 });
  stroke(bez([-10, -22], [-30, -24], [-50, -30], [-64, -40]), { w: 3.2 });
  stroke(bez([-4, -18], [-28, -14], [-48, -18], [-66, -30]), { w: 3.2 });
  // head tilted back, eyes closed, smile
  const hx = 30, hy = -98;
  washCircle(hx, hy, 26, C.skin, { a: 0.55 });
  stroke(circle(hx, hy, 27, 28), { w: 3 });
  stroke(arc(hx + 4, hy - 4, 27, 25, Math.PI * 1.25, Math.PI * 2.0), { w: 5 });
  stroke(arc(hx - 8, hy - 2, 5, 3, 0.2, 2.9), { w: 2.2 }); stroke(arc(hx + 8, hy - 2, 5, 3, 0.2, 2.9), { w: 2.2 });
  stroke(arc(hx, hy + 9, 9, 6, 0.3, 2.8), { w: 2.4 });
  // arm with cup
  stroke(bez([16, -60], [-6, -56], [-16, -64], [-18, -76]), { w: 3 });
  washRect(-30, -96, 22, 22, C.cream, { a: 1 }); stroke(rrect(-30, -96, 22, 22, 4), { w: 2.4 });
  steam(-19, -100, 34, 2, 0.8, t);
  pop();
}

function orgLines(p, a) {
  group(4900);
  const o = { w: 2.8, p, a }, b1 = Y0 + 34, b2 = Y1 + 42, top = 168;
  stroke(seg(960, Y0 + 6, 960, b1), o); stroke(seg(MGR[0], b1, MGR[3], b1), o);
  for (const m of MGR) {
    stroke(seg(m, b1, m, Y1 - top), o); stroke(seg(m, Y1 + 6, m, b2), o);
    stroke(seg(m - 140, b2, m + 140, b2), o);
    for (const d of [-140, 0, 140]) stroke(seg(m + d, b2, m + d, Y2 - top), o);
  }
}

export function office(t) {
  const linesA = 1 - prog(t, 18.8, 19.3);
  orgLines(ease(prog(t, 14.8, 15.5)), linesA);
  // humans that stay: from their chart spot to a lounge seat
  const mv = ease(prog(t, 19.0, 19.9));
  // agents behind the people first, then people, then agents in front
  const ag = agentsList.map(s => {
    const k = ease(prog(t, s.tf + 0.35 + hash(s.i, 3) * 0.2, s.tf + 1.25 + hash(s.i, 3) * 0.2));
    const [rx, ry, , sp] = RING[s.ring];
    const ang = s.a0 + (t - 19) * sp * Math.max(0.2, k);
    const ox = RC[0] + Math.cos(ang) * rx, oy = RC[1] + Math.sin(ang) * ry;
    return { s, k, x: lerp(s.x, ox, k), y: lerp(s.y - 70 * S, oy, k) + Math.sin(t * 5 + s.i) * 5 * k, back: Math.sin(ang) < 0 };
  });
  const drawAgent = ({ s, k, x, y }) => {
    if (t < s.tf) { busy(s.x, s.y, S, s.i, t, appear(t, s)); return; }
    const pf = prog(t, s.tf, s.tf + 0.35);
    if (pf < 1) puff(s.x, s.y - 70 * S, pf, s.i);
    if (pf > 0.4) agent(x, y, 1.3 * back(prog(t, s.tf + 0.12, s.tf + 0.4)), 1, s.i, hash(s.i, Math.floor(t * 3)) > 0.93 ? 1 : 0);
    if (k > 0.9) for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) {
      const ph = (t * 2.2 + q * 0.5 + s.i * 0.3) % 1;
      stroke(arc(x, y, 40 + ph * 26, 30 + ph * 20, sd > 0 ? -0.5 : Math.PI - 0.5, sd > 0 ? 0.5 : Math.PI + 0.5), { w: 2, a: (1 - ph) * 0.6, c: C.blue });
    }
  };
  if (t > 19.2) {
    group(4950);
    for (const [rx, ry] of RING) stroke(arc(RC[0], RC[1], rx, ry, 0, Math.PI * 2), { w: 1.8, a: 0.35 * prog(t, 19.3, 19.9), p: prog(t, 19.3, 20.1) });
  }
  ag.filter(g => g.back || t < 19.2).forEach(drawAgent);
  KEEP.forEach((i, j) => {
    const s = STAFF[i];
    if (t < 18.95) { busy(s.x, s.y, S, i, t, appear(t, s)); return; }
    const x = lerp(s.x, SEATS[j][0], mv), y = lerp(s.y, SEATS[j][1], mv);
    if (t < 19.1) puff(s.x, s.y - 70 * S, prog(t, 18.95, 19.25), 30 + i);
    if (t > 19.05) relaxed(x, y, lerp(S, 1.6, mv), SEATS[j][0] > 960 ? -1 : 1, i, t, prog(t, 19.05, 19.3));
  });
  ag.filter(g => !(g.back || t < 19.2)).forEach(drawAgent);
}

function appear(t, s) { const d = 14.55 + s.role * 0.2 + (s.x / 1920) * 0.25; return prog(t, d, d + 0.3); }

// Ink scribble burst used for the transformation.
function puff(x, y, k, seed) {
  group(4800 + seed);
  const r = 30 + 60 * easeOut(k), a = 1 - k;
  const pts = []; for (let q = 0; q <= 40; q++) { const ang = q / 40 * Math.PI * 2.1; const rr = r * (0.75 + 0.3 * Math.sin(q * 2.7 + seed)); pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]); }
  stroke(pts, { w: 3, a });
  for (let q = 0; q < 8; q++) { const ang = q / 8 * 6.283 + seed; stroke(seg(x + Math.cos(ang) * r * 1.1, y + Math.sin(ang) * r * 1.1, x + Math.cos(ang) * r * 1.45, y + Math.sin(ang) * r * 1.45), { w: 2.6, a, c: C.red }); }
  glow(x, y, r * 1.3, C.gold, 0.5 * a);
}
