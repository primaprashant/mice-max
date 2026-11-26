// Characters and small props: attendees, planes, coins, AI agents, place icons.
import { C, D, push, pop, group, stroke, seg, arc, circle, rectP, bez, rrect, dot, wash, washRect, washCircle, glow, hash, clamp } from './ink.js';

// Attendee with big head, lanyard and optional rolling suitcase. Feet at (x, y).
export function person(x, y, o = {}) {
  const s = o.s ?? 1, dir = o.dir ?? 1, ph = o.ph ?? 0, walk = o.walk ?? 1, seed = o.seed ?? 1;
  const bob = -Math.abs(Math.sin(ph)) * 4 * walk;
  push(x, y + bob, [s * dir, s], 0, o.a ?? 1);
  group(seed * 31);
  const sw = Math.sin(ph) * 0.5 * walk, shirt = o.shirt ?? C.blue;
  if (o.case) {
    washRect(-50, -40, 26, 38, o.caseCol ?? C.red, { a: 0.8 });
    stroke(rrect(-50, -40, 26, 38, 5), { w: 2.6 });
    stroke(seg(-37, -40, -37, -50), { w: 2.4 }); stroke(seg(-37, -50, -20, -46), { w: 2.4 });
    dot(-45, 0, 3.2); dot(-29, 0, 3.2);
  }
  // legs
  stroke([[-4, -34], [-4 + Math.sin(sw) * 26, -34 + Math.cos(sw) * 34]], { w: 3.4 });
  stroke([[4, -34], [4 - Math.sin(sw) * 26, -34 + Math.cos(sw) * 34]], { w: 3.4 });
  // torso
  const torso = [[-13, -64], [13, -64], [15, -36], [11, -30], [-11, -30], [-15, -36]];
  wash(torso, shirt, { a: 0.8 });
  stroke([...bez([-13, -64], [-17, -50], [-16, -36], [-11, -30]), ...seg(-11, -30, 11, -30), ...bez([11, -30], [16, -36], [17, -50], [13, -64])], { w: 2.8 });
  // arms
  if (o.case) stroke(bez([-11, -60], [-18, -54], [-20, -50], [-21, -46]), { w: 3 });
  else stroke([[-11, -60], [-11 + Math.sin(-sw) * 14, -38]], { w: 3 });
  stroke([[11, -60], [11 + Math.sin(sw) * 16 + 3, -38]], { w: 3 });
  // lanyard and badge
  stroke([[-8, -64], [0, -48], [8, -64]], { w: 1.8, c: C.red });
  washRect(-6, -50, 12, 13, C.cream, { a: 1 });
  stroke(rectP(-6, -50, 12, 13), { w: 1.8 });
  // head
  washCircle(2, -88, 21, C.skin, { a: 0.55 });
  stroke(circle(2, -88, 22, 23), { w: 3 });
  const hair = Math.floor(hash(seed, 3) * 3);
  if (hair === 0) stroke(arc(2, -90, 22, 21, Math.PI * 1.05, Math.PI * 1.95), { w: 6 });
  else if (hair === 1) { stroke(arc(2, -92, 21, 19, Math.PI * 1.1, Math.PI * 1.9), { w: 5 }); washCircle(-16, -98, 8, C.ink, { a: 0.9 }); stroke(circle(-16, -98, 7), { w: 2.4 }); }
  else stroke(bez([-16, -100], [-8, -116], [10, -116], [20, -98]), { w: 4 });
  if (o.sad) { stroke(arc(12, -74, 6, 4, Math.PI * 1.15, Math.PI * 1.85), { w: 2.2 }); }
  else stroke(arc(12, -80, 7, 5, 0.3, 2.6), { w: 2.2 });
  dot(9, -90, 2.6); dot(19, -90, 2.6);
  pop();
}

// Side-view airliner facing right, centered at (x, y).
export function plane(x, y, s = 1, rot = 0, a = 1, seed = 5) {
  push(x, y, s, rot, a); group(seed);
  const body = [...arc(130, 0, 40, 26, -Math.PI / 2, Math.PI / 2), [-150, 26], [-178, 4], [-190, -26], [130, -26]];
  wash(body, C.cream, { a: 1 });
  wash([[-150, -24], [-190, -80], [-160, -80], [-110, -24]], C.red, { a: 0.9 });
  stroke([...seg(-178, 4, -150, 26), ...seg(-150, 26, 130, 26), ...arc(130, 0, 40, 26, Math.PI / 2, -Math.PI / 2), ...seg(130, -26, -110, -26)], { w: 3 });
  stroke([[-110, -26], [-160, -82], [-192, -82], [-178, 4]], { w: 3 });
  stroke([[10, 6], [-60, 50], [-30, 50], [50, 6]], { w: 2.8 });
  wash([[10, 6], [-60, 50], [-30, 50], [50, 6]], C.blue, { a: 0.6 });
  for (let i = 0; i < 9; i++) dot(-90 + i * 22, -8, 4);
  stroke(rectP(120, -16, 14, 30), { w: 2 });
  stroke(arc(140, -6, 18, 12, -1.6, -0.3), { w: 2.4 });
  pop();
}

export function coin(x, y, r = 16, a = 1) {
  push(x, y, r / 16, 0, a); group(711);
  washCircle(0, 0, 15, C.gold, { a: 1 });
  stroke(circle(0, 0, 16), { w: 2.6 });
  stroke([[-6, -9], [0, -1], [6, -9]], { w: 2.2 }); stroke(seg(0, -1, 0, 9), { w: 2.2 });
  stroke(seg(-6, 1, 6, 1), { w: 1.8 }); stroke(seg(-6, 5, 6, 5), { w: 1.8 });
  pop();
}

export function note(x, y, s = 1, rot = 0, a = 1) {
  push(x, y, s, rot, a); group(733);
  washRect(-40, -20, 80, 40, C.gold, { a: 0.85 });
  stroke(rrect(-40, -20, 80, 40, 4), { w: 2.4 });
  stroke(circle(0, 0, 11), { w: 2 });
  stroke([[-4, -6], [0, -1], [4, -6]], { w: 1.6 }); stroke(seg(0, -1, 0, 6), { w: 1.6 });
  pop();
}

// Friendly AI agent: rounded screen-head with antenna.
export function agent(x, y, s = 1, a = 1, seed = 1, blink = 0) {
  push(x, y, s, 0, a); group(900 + seed);
  glow(0, 0, 54, C.sky, 0.5);
  wash(rrect(-26, -22, 52, 42, 13), C.blue, { a: 0.9 });
  stroke(rrect(-26, -22, 52, 42, 13), { w: 3 });
  stroke(seg(0, -22, 0, -36), { w: 2.6 });
  washCircle(0, -40, 6, C.gold, { a: 1 }); stroke(circle(0, -40, 6), { w: 2.2 });
  const e = blink > 0.5 ? 1 : 5;
  push(0, 0, [1, e / 5]);
  dot(-9, -2, 5, { c: C.cream }); dot(9, -2, 5, { c: C.cream });
  pop();
  stroke(arc(0, 6, 8, 5, 0.4, 2.7), { w: 2.2, c: C.cream });
  stroke(seg(-30, -2, -36, -2), { w: 2.4 }); stroke(seg(30, -2, 36, -2), { w: 2.4 });
  pop();
}

// Wavy steam lines rising, animated by t.
export function steam(x, y, h, n = 3, a = 1, t = D.t) {
  for (let i = 0; i < n; i++) {
    const ox = x + (i - (n - 1) / 2) * 16, pts = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([ox + Math.sin(u * 6 + t * 4 + i * 2) * 5, y - u * h]); }
    stroke(pts, { w: 2.4, a: a * 0.85, p: 1 });
  }
}

// ---- icons for free-time slots (centered, ~200 units wide) ----
export function onsenIcon(x, y, s = 1, p = 1) {
  push(x, y, s); group(1201);
  wash([...arc(0, 10, 80, 50, 0, Math.PI)], C.sky, { a: 0.8 * p });
  stroke(arc(0, 10, 80, 50, 0, Math.PI), { w: 3.4, p: p * 1.4 });
  stroke(seg(-88, 10, 88, 10), { w: 3.4, p: p * 1.4 });
  for (let i = 0; i < 3; i++) stroke(bez([-36 + i * 36, -10], [-50 + i * 36, -40], [-22 + i * 36, -60], [-36 + i * 36, -90]), { w: 3.2, p: p * 1.6 - 0.4 - i * 0.1, c: C.red });
  pop();
}
export function ramenIcon(x, y, s = 1, p = 1) {
  push(x, y, s); group(1301);
  wash(arc(0, 0, 84, 66, 0, Math.PI), C.red, { a: 0.8 * p });
  stroke(arc(0, 0, 84, 66, 0, Math.PI), { w: 3.4, p: p * 1.4 });
  stroke(circle(0, 0, 86, 16), { w: 3, p: p * 1.4 });
  for (let i = 0; i < 3; i++) stroke(bez([-50 + i * 20, 0], [-40 + i * 20, -30], [-30 + i * 20, 10], [-20 + i * 20, -20]), { w: 2.4, p: p * 1.4 - 0.4 });
  stroke(seg(10, 6, 100, -80), { w: 3.6, p: p * 1.5 - 0.5 }); stroke(seg(26, 8, 112, -66), { w: 3.6, p: p * 1.5 - 0.5 });
  washCircle(40, -4, 14, C.cream, { a: p }); washCircle(40, -4, 6, C.gold, { a: p });
  stroke(circle(40, -4, 14, 9), { w: 2.2, p: p * 1.4 - 0.3 });
  pop();
}
export function nightIcon(x, y, s = 1, p = 1) {
  push(x, y, s); group(1401);
  wash([[-100, 60], [-20, -50], [20, -10], [50, -40], [100, 60]], C.blue, { a: 0.85 * p });
  stroke([[-100, 60], [-20, -50], [20, -10], [50, -40], [100, 60]].map(q => q), { w: 3.4, p: p * 1.4 });
  stroke(resampleMoon(), { w: 3, p: p * 1.4 - 0.3, c: C.ink });
  washCircle(-70, -68, 18, C.gold, { a: p });
  for (let i = 0; i < 9; i++) {
    const lx = -70 + i * 18, ly = 48 - (hash(i, 4) * 26) * (1 - Math.abs(i - 4) / 6);
    dot(lx, ly, 4, { c: C.gold, a: clamp(p * 2 - 1 - i * 0.05) });
  }
  pop();
}
function resampleMoon() { return [...arc(-70, -68, 20, 20, -1.2, 3.6)]; }
