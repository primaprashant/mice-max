// Street buildings in world units. Ground (building base) at y = 860.
// lit: -1 dark and empty, 0 plain sketch, 1 warm and busy.
import { C, D, push, pop, group, stroke, seg, arc, circle, rectP, bez, rrect, dot, wash, washRect, washCircle, glow, hash, clamp, dashed } from './ink.js';
import { steam } from './figures.js';

const B = 860;
const darkness = lit => clamp(-lit), warm = lit => clamp(lit);

export function dim(x, y, w, h, lit) {
  if (lit >= 0) return;
  const j = (i, s) => (hash(x + i, 3) - 0.5) * s;
  wash([[x + j(1, 20), y + j(2, 20)], [x + w / 2, y - 6 + j(3, 16)], [x + w + j(4, 20), y + j(5, 20)], [x + w + j(6, 14), y + h + 4], [x + j(7, 14), y + h + 4]], C.grey, { a: 0.42 * darkness(lit), still: true, occ: false });
}
function shade(pts, lit) { if (lit < 0) wash(pts, C.grey, { a: 0.55 * darkness(lit), occ: false }); }
function shutter(x, y, w, h, lit) {
  if (lit >= 0) return;
  const a = darkness(lit);
  washRect(x, y, w, h, C.grey, { a: 0.7 * a });
  for (let k = 1; k < 6; k++) stroke(seg(x + 4, y + h * k / 6, x + w - 4, y + h * k / 6), { w: 1.8, a });
}

export function airport() {
  group(2001);
  stroke(seg(-500, B + 10, 700, B + 10), { w: 3 });
  dashed(seg(-400, B + 34, 640, B + 34), 30, 26, { w: 3 });
  // control tower
  wash([[20, B], [20, 600], [70, 600], [70, B]], C.sky, { a: 0.35 });
  stroke([[20, B], [24, 600]], { w: 3 }); stroke([[70, B], [66, 600]], { w: 3 });
  wash([[-12, 600], [102, 600], [90, 540], [0, 540]], C.blue, { a: 0.7 });
  stroke([[-12, 600], [102, 600], [90, 540], [0, 540], [-12, 600]], { w: 3 });
  stroke(seg(10, 520, 80, 520), { w: 3 }); stroke(seg(45, 520, 45, 490), { w: 2.6 });
  dot(45, 486, 5, { c: C.red });
  // terminal
  wash([[90, B], [90, 700], [380, 690], [380, B]], C.sky, { a: 0.25 });
  stroke([[90, B], [90, 700], [380, 690], [380, B]], { w: 3 });
  for (let i = 0; i < 6; i++) stroke(seg(110 + i * 45, 720, 110 + i * 45, 840), { w: 1.6, a: 0.7 });
}

export function onsen(lit, t) {
  group(2101);
  const x = 760, w = 250;
  if (lit > 0) glow(x + w / 2, B - 120, 260 * warm(lit), C.gold, 0.55 * warm(lit));
  const wall = [[x + 20, B], [x + 20, B - 120], [x + w - 20, B - 120], [x + w - 20, B]];
  wash(wall, C.cream, { a: 0.9 });
  stroke(wall, { w: 3 });
  const roof = [...bez([x - 20, B - 120], [x + 30, B - 140], [x + 60, B - 200], [x + w / 2, B - 205]), ...bez([x + w / 2, B - 205], [x + w - 60, B - 200], [x + w - 30, B - 140], [x + w + 20, B - 120])];
  wash([...roof, [x - 20, B - 120]], lit > 0 ? C.red : C.ink, { a: lit > 0 ? 0.85 : 0.35 });
  stroke([...roof, [x - 20, B - 120]], { w: 3.2 });
  // noren curtain
  for (let i = 0; i < 4; i++) {
    const nx = x + 80 + i * 24;
    washRect(nx, B - 110, 20, 50, lit > 0 ? C.blue : C.grey, { a: 0.85 });
    stroke(rectP(nx, B - 110, 20, 50), { w: 2 });
  }
  // windows
  for (const wx of [x + 34, x + w - 70]) {
    washRect(wx, B - 100, 36, 40, lit > 0 ? C.gold : C.grey, { a: lit > 0 ? 0.9 * warm(lit) + 0.1 : 0.4 + 0.4 * darkness(lit) });
    stroke(rectP(wx, B - 100, 36, 40), { w: 2.2 });
  }
  shade(wall, lit);
  if (lit > 0) steam(x + w / 2, B - 215, 70 * warm(lit), 3, warm(lit), t);
  dim(x - 30, B - 215, w + 60, 215, lit);
}

export function ramen(lit, t) {
  group(2201);
  const x = 1080, w = 180;
  if (lit > 0) glow(x + w / 2, B - 90, 210 * warm(lit), C.gold, 0.55 * warm(lit));
  const roof = [[x - 16, B - 150], [x + w / 2, B - 185], [x + w + 16, B - 150]];
  wash([...roof], lit > 0 ? C.red : C.ink, { a: lit > 0 ? 0.85 : 0.3 });
  stroke([...roof, [x - 16, B - 150]], { w: 3 });
  stroke(seg(x + 4, B - 150, x + 4, B), { w: 3 }); stroke(seg(x + w - 4, B - 150, x + w - 4, B), { w: 3 });
  // noren strips
  for (let i = 0; i < 5; i++) {
    const nx = x + 10 + i * 33;
    wash([[nx, B - 150], [nx + 28, B - 150], [nx + 28, B - 112], [nx, B - 112]], lit >= 0 ? C.blue : C.grey, { a: 0.8 });
    stroke(rectP(nx, B - 150, 28, 38), { w: 1.8 });
  }
  // counter
  washRect(x - 6, B - 60, w + 12, 60, C.cream, { a: 0.9 });
  stroke(rectP(x - 6, B - 60, w + 12, 60), { w: 3 });
  // lantern
  washCircle(x + w + 30, B - 120, 18, lit > 0 ? C.red : C.grey, { a: 0.9 });
  stroke(circle(x + w + 30, B - 120, 16, 22), { w: 2.6 });
  if (lit > 0) {
    glow(x + w + 30, B - 120, 60, C.red, 0.4 * warm(lit));
    for (let i = 0; i < 2; i++) {
      washCircle(x + 50 + i * 80, B - 70, 18, C.red, { a: warm(lit) });
      stroke(arc(x + 50 + i * 80, B - 70, 20, 16, 0, Math.PI), { w: 2.4, a: warm(lit) });
      steam(x + 50 + i * 80, B - 82, 40 * warm(lit), 2, warm(lit), t + i);
    }
  }
  shutter(x + 4, B - 110, w - 8, 50, lit);
  dim(x - 25, B - 190, w + 80, 190, lit);
}

export function market(lit, t) {
  group(2301);
  const x = 1350, w = 220;
  if (lit > 0) glow(x + w / 2, B - 80, 220 * warm(lit), C.gold, 0.5 * warm(lit));
  stroke(seg(x, B - 130, x, B), { w: 3 }); stroke(seg(x + w, B - 130, x + w, B), { w: 3 });
  // striped awning
  for (let i = 0; i < 6; i++) {
    const ax = x - 10 + i * (w + 20) / 6, aw = (w + 20) / 6;
    wash([[ax, B - 160], [ax + aw, B - 160], [ax + aw, B - 126], [ax, B - 126]], i % 2 ? C.cream : (lit > 0 ? C.red : C.grey), { a: 0.9 });
    stroke(arc(ax + aw / 2, B - 126, aw / 2, 8, 0, Math.PI), { w: 2 });
  }
  stroke(rectP(x - 10, B - 160, w + 20, 34), { w: 3 });
  // crates with crab and fish
  washRect(x + 10, B - 50, w - 20, 50, C.cream, { a: 0.9 });
  stroke(rectP(x + 10, B - 50, w - 20, 50), { w: 3 });
  if (lit >= 0) {
    washCircle(x + 60, B - 62, 22, C.red, { a: 0.85 }); stroke(circle(x + 60, B - 62, 24, 16), { w: 2.4 });
    stroke([[x + 36, B - 70], [x + 26, B - 86]], { w: 2.4 }); stroke([[x + 84, B - 70], [x + 94, B - 86]], { w: 2.4 });
    wash([[x + 120, B - 60], [x + 160, B - 74], [x + 190, B - 60], [x + 160, B - 48]], C.sky, { a: 0.85 });
    stroke([[x + 120, B - 60], [x + 160, B - 74], [x + 190, B - 60], [x + 160, B - 48], [x + 120, B - 60]], { w: 2.4 });
  }
  shutter(x + 4, B - 120, w - 8, 70, lit);
  dim(x - 15, B - 165, w + 30, 165, lit);
}

export function izakaya(lit, t) {
  group(2401);
  const x = 1630, w = 230;
  if (lit > 0) glow(x + w / 2, B - 110, 250 * warm(lit), C.gold, 0.5 * warm(lit));
  const wall = [[x, B], [x, B - 200], [x + w, B - 200], [x + w, B]];
  wash(wall, C.cream, { a: 0.9 });
  stroke(wall, { w: 3 });
  stroke(seg(x - 14, B - 200, x + w + 14, B - 200), { w: 4 });
  washRect(x + 30, B - 150, w - 60, 70, lit > 0 ? C.gold : C.grey, { a: lit > 0 ? 0.85 * warm(lit) + 0.1 : 0.35 + 0.4 * darkness(lit) });
  stroke(rectP(x + 30, B - 150, w - 60, 70), { w: 2.4 });
  stroke(seg(x + w / 2, B - 150, x + w / 2, B - 80), { w: 2 });
  stroke(rectP(x + 80, B - 64, 70, 64), { w: 2.6 });
  for (const lx of [x + 20, x + w - 20]) {
    stroke(seg(lx, B - 200, lx, B - 186), { w: 2 });
    washCircle(lx, B - 166, 18, lit > 0 ? C.red : C.grey, { a: 0.9 });
    stroke(circle(lx, B - 166, 15, 20), { w: 2.4 });
    if (lit > 0) glow(lx, B - 166, 60, C.red, 0.45 * warm(lit));
  }
  shade(wall, lit);
  dim(x - 20, B - 205, w + 40, 205, lit);
}

// Mt Moiwa backdrop with ropeway; lit adds night sky and city lights.
export function moiwa(lit, t) {
  group(2501);
  const ridge = [[880, B], ...bez([880, B], [1050, 700], [1160, 560], [1320, 540]), ...bez([1320, 540], [1460, 560], [1600, 690], [1800, B])];
  if (lit > 0) {
    glow(1330, 600, 420 * warm(lit), C.blue, 0.55 * warm(lit));
    washCircle(1010, 500, 26, C.gold, { a: warm(lit) });
  }
  wash(ridge, lit > 0 ? C.blue : lit < 0 ? C.grey : C.green, { a: lit > 0 ? 0.35 + 0.35 * warm(lit) : 0.35 });
  stroke(ridge, { w: 3 });
  stroke(bez([1180, 600], [1230, 590], [1260, 570], [1300, 560]), { w: 1.6, a: 0.6 });
  // ropeway
  stroke(seg(1260, 760, 1320, 548), { w: 1.8 });
  const g = (Math.sin(t * 0.8) + 1) / 2, gx = 1260 + 60 * g, gy = 760 - 212 * g;
  washRect(gx - 10, gy + 6, 20, 16, C.red, { a: 0.9 }); stroke(rectP(gx - 10, gy + 6, 20, 16), { w: 2 }); stroke(seg(gx, gy, gx, gy + 6), { w: 1.6 });
  if (lit > 0) {
    stroke(arc(1010, 500, 28, 28, -1.2, 3.6), { w: 2.6, a: warm(lit) });
    for (let i = 0; i < 22; i++) {
      const u = hash(i, 9), v = hash(i, 10);
      const lx = 980 + u * 700, ly = B - 20 - v * 90;
      dot(lx, ly, 3.5 + 2 * hash(i, 11), { c: C.gold, a: clamp(warm(lit) * 2 - u) * (0.6 + 0.4 * Math.sin(t * 6 + i)) });
    }
  }
}

// Convention center. Door at x 2010..2110, schedule board at x 2200..2600, y 590..815.
export const BOARD = { x: 2200, y: 590, w: 400, h: 225 };
export function convention() {
  group(2601);
  const x0 = 1960, x1 = 2800;
  const roof = bez([x0 - 30, 560], [2200, 440], [2560, 440], [x1 + 30, 560]);
  wash([...roof, [x1, B], [x0, B]], C.sky, { a: 0.4 });
  wash([...roof, ...bez([x1 + 30, 560], [2560, 470], [2200, 470], [x0 - 30, 560])], C.blue, { a: 0.85 });
  stroke(roof, { w: 3.4 });
  stroke(bez([x0 - 30, 560], [2200, 470], [2560, 470], [x1 + 30, 560]), { w: 2.6 });
  stroke(seg(x0, 548, x0, B), { w: 3.2 }); stroke(seg(x1, 548, x1, B), { w: 3.2 });
  // glass mullions
  for (let i = 1; i < 6; i++) stroke(seg(x1 - 160 + i * 26, 520, x1 - 160 + i * 26, 830), { w: 1.4, a: 0.5 });
  // door
  washRect(2010, 740, 100, 120, C.gold, { a: 0.5 });
  stroke(rectP(2010, 740, 100, 120), { w: 3 }); stroke(seg(2060, 740, 2060, 860), { w: 2 });
  // flags
  for (const fx of [2240, 2560]) {
    stroke(seg(fx, 470, fx, 400), { w: 2.4 });
    wash([[fx, 400], [fx + 44, 412], [fx, 424]], C.red, { a: 0.9 });
    stroke([[fx, 400], [fx + 44, 412], [fx, 424]], { w: 2 });
  }
  const b = BOARD;
  washRect(b.x, b.y, b.w, b.h, C.cream, { a: 1 });
  stroke(rectP(b.x - 8, b.y - 8, b.w + 16, b.h + 16), { w: 3.4 });
  stroke(seg(b.x + 60, b.y + b.h + 8, b.x + 60, B), { w: 3 }); stroke(seg(b.x + b.w - 60, b.y + b.h + 8, b.x + b.w - 60, B), { w: 3 });
}

// Distant city: TV tower and blocks, drawn light behind everything.
export function skyline() {
  group(2701);
  const o = { w: 2.2, a: 0.55 };
  [[700, 230, 110], [820, 300, 90], [1690, 290, 120], [1820, 220, 100], [2860, 260, 120], [-120, 200, 110]].forEach(([x, h, w]) => {
    wash([[x, 860], [x, 860 - h], [x + w, 860 - h], [x + w, 860]], C.sky, { a: 0.3 });
    stroke([[x, 860], [x, 860 - h], [x + w, 860 - h], [x + w, 860]], o);
    for (let r = 860 - h + 24; r < 840; r += 30) for (let c = x + 16; c < x + w - 14; c += 26) stroke(seg(c, r, c + 10, r), { w: 1.6, a: 0.35 });
  });
  // Sapporo TV tower
  const tx = 1560;
  stroke(seg(tx - 40, 860, tx - 8, 520), o); stroke(seg(tx + 40, 860, tx + 8, 520), o);
  for (let k = 0; k < 7; k++) { const y0 = 860 - k * 48.5, y1 = y0 - 48.5, w0 = 40 - k * 4.6, w1 = 40 - (k + 1) * 4.6; stroke(seg(tx - w0, y0, tx + w1, y1), { w: 1.4, a: 0.4 }); stroke(seg(tx + w0, y0, tx - w1, y1), { w: 1.4, a: 0.4 }); }
  wash([[tx - 22, 520], [tx + 22, 520], [tx + 22, 490], [tx - 22, 490]], C.red, { a: 0.6 });
  stroke(rectP(tx - 22, 490, 44, 30), o);
  stroke(seg(tx, 490, tx, 420), o);
}

export function clouds(t) {
  group(2801);
  [[160, 450, 1.0], [2060, 440, 1.1], [2480, 470, 0.9], [-320, 430, 1.0]].forEach(([x, y, s], i) => {
    push(x + t * 12 * (1 + i * 0.2), y, s);
    const pts = [[-90, 20], ...arc(-55, 2, 34, 26, Math.PI, Math.PI * 1.9), ...arc(0, -12, 46, 40, Math.PI * 1.1, Math.PI * 1.95), ...arc(55, 4, 36, 26, Math.PI * 1.15, Math.PI * 2.05), [92, 20]];
    wash([...pts], C.cream, { a: 0.95 });
    stroke(pts, { w: 2.4, a: 0.8 });
    stroke(seg(-80, 20, 84, 20), { w: 1.8, a: 0.45 });
    pop();
  });
}
