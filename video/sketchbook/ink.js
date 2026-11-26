// Hand-drawn primitives. Two 2D canvases: D.I (ink lines) and D.F (watercolor fills).
// Everything depends on D.t only; line boil changes at 12fps through D.bf.

export const C = {
  ink: '#211b16', red: '#d4442a', blue: '#2f4f8a', gold: '#e6a52b',
  grey: '#7d7a78', sky: '#9db6d8', green: '#7ea067', skin: '#f2cfae', cream: '#fbf3e2',
};

export const D = { I: null, F: null, t: 0, bf: 0, sc: 1, alpha: 1, sb: 1, si: 0, pan: [0, 0] };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const easeOut = k => 1 - Math.pow(1 - k, 3);
export const easeIn = k => k * k * k;
export const back = k => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);

export function hash(a, b = 0) {
  let x = Math.imul((a | 0) ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
export const rand = (seed, i) => hash(seed * 7919 + i * 104729, 77);

const stack = [];
// Push a transform on both canvases. s may be [sx, sy].
export function push(x = 0, y = 0, s = 1, rot = 0, alpha = 1) {
  const [sx, sy] = Array.isArray(s) ? s : [s, s];
  stack.push([D.sc, D.alpha]);
  for (const c of [D.I, D.F]) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(sx, sy); }
  D.sc *= Math.sqrt(Math.abs(sx * sy)); D.alpha *= alpha;
}
export function pop() {
  D.I.restore(); D.F.restore();
  [D.sc, D.alpha] = stack.pop();
}
// Start a group of strokes with stable seeds (so boil is steady within a 12fps frame).
export function group(seed) { D.sb = seed; D.si = 0; }

// ---- point generators (local units, sampled for the current zoom) ----
const step = () => 9 / D.sc;
export function resample(poly, closed = false) {
  const src = closed ? [...poly, poly[0]] : poly, out = [src[0]];
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1], [bx, by] = src[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step()));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
export const seg = (x1, y1, x2, y2) => resample([[x1, y1], [x2, y2]]);
export function arc(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / step()));
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}
export const circle = (cx, cy, rx, ry = rx, a0 = -2.2) => arc(cx, cy, rx, ry, a0, a0 + Math.PI * 2.12);
export const rectP = (x, y, w, h) => resample([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y - 2 / D.sc]]);
export function bez(p0, p1, p2, p3) {
  const out = [], n = Math.max(8, Math.ceil((Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) / step()));
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

// ---- ink stroke: wobbly, tapered ribbon, revealed up to fraction p ----
export function stroke(pts, o = {}) {
  const p = o.p ?? 1, a = (o.a ?? 1) * D.alpha;
  if (p <= 0.002 || a <= 0.004 || !pts || pts.length < 2) return;
  pts = resample(pts);
  const seed = o.s ?? hash(D.sb, D.si++) * 1e6;
  const k = D.sc, n = pts.length, L = new Float32Array(n);
  for (let i = 1; i < n; i++) L[i] = L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const tot = L[n - 1] || 1e-6, end = tot * Math.min(1, p);
  const bf = o.still ? 0 : D.bf;
  const r1 = hash(seed, bf), r2 = hash(seed + 1, bf), r3 = hash(seed + 2, bf), r4 = hash(seed + 3, bf);
  const amp = (o.wob ?? 1.4) / k, f1 = (0.012 + r1 * 0.02) * k, f2 = (0.01 + r2 * 0.02) * k;
  const dx = (r3 - 0.5) * amp * 1.6, dy = (r4 - 0.5) * amp * 1.6, ph1 = r1 * 40, ph2 = r2 * 40;
  const P = [];
  for (let i = 0; i < n; i++) {
    let x = pts[i][0], y = pts[i][1], l = L[i];
    if (l > end) {
      const f = (end - L[i - 1]) / (l - L[i - 1] || 1);
      x = pts[i - 1][0] + (x - pts[i - 1][0]) * f; y = pts[i - 1][1] + (y - pts[i - 1][1]) * f; l = end;
    }
    P.push([x + dx + amp * Math.sin(l * f1 + ph1), y + dy + amp * Math.sin(l * f2 + ph2), l]);
    if (l >= end) break;
  }
  if (P.length < 2) return;
  const w = (o.w ?? 3) / k, cap = Math.min(tot * 0.25, 16 / k), m = P.length;
  const left = [], right = [];
  for (let i = 0; i < m; i++) {
    const A = P[Math.max(0, i - 1)], B = P[Math.min(m - 1, i + 1)];
    let nx = -(B[1] - A[1]), ny = B[0] - A[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const l = P[i][2];
    const tap = Math.min(1, 0.3 + 0.7 * Math.min(l, tot - l, (end - l) + cap * 0.5) / cap);
    const hw = w * 0.5 * Math.max(0.25, tap) * (0.85 + 0.15 * Math.sin(l * k * 0.05 + ph1));
    left.push([P[i][0] + nx * hw, P[i][1] + ny * hw]); right.push([P[i][0] - nx * hw, P[i][1] - ny * hw]);
  }
  const c = D.I;
  c.globalAlpha = a; c.fillStyle = o.c ?? C.ink;
  c.beginPath(); c.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < m; i++) c.lineTo(left[i][0], left[i][1]);
  for (let i = m - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
  c.closePath(); c.fill();
}
export const strokes = (list, o = {}) => list.forEach(pts => stroke(pts, o));

export function dot(x, y, r, o = {}) {
  const a = (o.a ?? 1) * D.alpha; if (a <= 0.004) return;
  const c = D.I; c.globalAlpha = a; c.fillStyle = o.c ?? C.ink;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

// ---- watercolor fills on D.F (the shader adds granulation and dark edges) ----
function jit(o) {
  const s = o.s ?? hash(D.sb, D.si++) * 1e6, bf = o.still ? 0 : D.bf;
  return [(hash(s, bf) - 0.5) * 3 / D.sc, (hash(s + 9, bf) - 0.5) * 3 / D.sc];
}
export function wash(pts, col, o = {}) {
  const a = (o.a ?? 0.85) * D.alpha; if (a <= 0.004 || !pts || pts.length < 3) return;
  const [jx, jy] = jit(o), c = D.F;
  c.globalAlpha = a; c.fillStyle = col;
  c.beginPath(); c.moveTo(pts[0][0] + jx, pts[0][1] + jy);
  for (const q of pts) c.lineTo(q[0] + jx, q[1] + jy);
  c.closePath(); c.fill();
  // opaque paint hides ink drawn behind it (painter's order across both layers)
  if (o.occ !== false) {
    const k = D.I; k.globalCompositeOperation = 'destination-out'; k.globalAlpha = Math.min(1, a * 1.15);
    k.beginPath(); k.moveTo(pts[0][0], pts[0][1]); for (const q of pts) k.lineTo(q[0], q[1]); k.closePath(); k.fill();
    k.globalCompositeOperation = 'source-over';
  }
}
export const washRect = (x, y, w, h, col, o) => wash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col, o);
export const washCircle = (cx, cy, r, col, o) => wash(arc(cx, cy, r, r, 0, Math.PI * 2), col, o);
export function glow(cx, cy, r, col, a = 0.6) {
  a *= D.alpha; if (a <= 0.004) return;
  const c = D.F, g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, col); g.addColorStop(1, col + '00');
  c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
}

// Hand-lettered text, revealed character by character with p in [0,1].
export function hand(str, x, y, size, p = 1, o = {}) {
  const c = D.I, a = (o.a ?? 1) * D.alpha;
  if (p <= 0 || a <= 0.004) return;
  c.font = `${o.weight ?? 700} ${size}px Caveat`; c.textBaseline = 'alphabetic'; c.fillStyle = o.c ?? C.ink;
  const ws = [...str].map(ch => c.measureText(ch).width), tot = ws.reduce((s, v) => s + v, 0) * 0.985;
  let cx = x - tot / 2;
  const n = ws.length, head = p * (n + 4);
  [...str].forEach((ch, i) => {
    const r = clamp(head - i - 0.0, 0, 4) / 4;
    if (r > 0) {
      const k = easeOut(r), s = 0.7 + 0.3 * back(Math.min(1, r * 1.2));
      const j1 = hash(i * 31 + (o.seed ?? 0), D.bf), j2 = hash(i * 17 + 5, D.bf);
      c.save(); c.globalAlpha = a * Math.min(1, k * 1.5);
      c.translate(cx + ws[i] / 2, y + (j2 - 0.5) * size * 0.02 + (1 - k) * size * 0.08);
      c.rotate((j1 - 0.5) * 0.04); c.scale(s, s);
      c.fillText(ch, -ws[i] / 2, 0);
      if (o.outline) { c.strokeStyle = o.outline; c.lineWidth = size * 0.028; c.lineJoin = 'round'; c.strokeText(ch, -ws[i] / 2, 0); }
      c.restore();
    }
    cx += ws[i] * 0.985;
  });
}
export function textWidth(str, size) { D.I.font = `700 ${size}px Caveat`; return D.I.measureText(str).width; }
export function rrect(x, y, w, h, r) {
  const q = Math.PI / 2;
  return [...arc(x + r, y + r, r, r, 2 * q, 3 * q), ...arc(x + w - r, y + r, r, r, 3 * q, 4 * q),
    ...arc(x + w - r, y + h - r, r, r, 0, q), ...arc(x + r, y + h - r, r, r, q, 2 * q), [x, y + r * 0.8]];
}
// Dashed line: many short strokes.
export function dashed(pts, dash = 14, gap = 10, o = {}) {
  let acc = 0, cur = [pts[0]], on = true;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (on) cur.push(pts[i]);
    if (acc >= (on ? dash : gap) / D.sc) {
      if (on && cur.length > 1) stroke(cur, o);
      on = !on; acc = 0; cur = [pts[i]];
    }
  }
  if (on && cur.length > 1) stroke(cur, o);
}
