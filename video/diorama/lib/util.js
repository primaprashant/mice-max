// Small math helpers shared by every module. Everything is a pure function of t.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const ease = k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = k => Math.pow(clamp(k), 3);
// Pop-in with overshoot, 0 -> 1.
export const backOut = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
// Window: 0 before a, 1 between a+f and b-f, 0 after b.
export const win = (t, a, b, f = 0.3) => smooth(a, a + f, t) * (1 - smooth(b - f, b, t));

// Seeded RNG (mulberry32).
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
// Stable hash noise for index i, 0..1.
export const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Smooth keyframe track: keys = [[t, ...values]]. Non-uniform Hermite, C1 in time.
export function track(keys) {
  const n = keys.length, dim = keys[0].length - 1;
  const tan = keys.map((k, i) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
    return Array.from({ length: dim }, (_, d) => {
      if (i === 0 || i === n - 1) return 0;
      const s0 = (k[d + 1] - a[d + 1]) / (k[0] - a[0]), s1 = (b[d + 1] - k[d + 1]) / (b[0] - k[0]);
      return s0 * s1 <= 0 ? 0 : (s0 + s1) / 2; // flat at turning points, no overshoot
    });
  });
  return t => {
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (keys[i + 1][0] < t) i++;
    const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    return a.slice(1).map((v, d) => h00 * v + h10 * h * tan[i][d] + h01 * b[d + 1] + h11 * h * tan[i + 1][d]);
  };
}
