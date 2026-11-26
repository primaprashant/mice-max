// Shared helpers: math, easing, seeded random, materials, glow sprites, staged pop-in.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  smooth: x => x * x * (3 - 2 * x),
  back: x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const C = {
  night: 0x0b1530, snow: 0xf4f7ff, amber: 0xffb347, warm: 0xffd08a, gold: 0xf2b53a,
  red: 0xd9473b, slate: 0x3a4a6b, ice: 0x9ecbff, teal: 0x5fe0d0,
};

const matCache = new Map();
export function mat(color, o = {}) {
  const { unique, ...p } = o;
  const key = color + JSON.stringify(p);
  if (!unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, ...p });
  if (!unique) matCache.set(key, m);
  return m;
}

export function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}

export const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  s.userData.size = size;
  return s;
}

// Staged pop: scale for an item that pops in at tin (+delay) and out at tout (+delay).
export function pop(t, tin, tout, d = 0, dur = 0.5) {
  const a = tin == null ? 1 : ease.back(prog(t, tin + d, tin + d + dur));
  const b = tout == null ? 0 : ease.in(prog(t, tout + d * 0.7, tout + d * 0.7 + dur * 0.7));
  return Math.max(0, a * (1 - b));
}

// A registry of objects that pop in and out together, staggered by distance from the center.
export class Stage {
  constructor(windows) { this.windows = windows; this.items = []; }
  add(obj, d) {
    if (d == null) d = 0.3 * Math.min(1, Math.hypot(obj.position.x, obj.position.z) / 9);
    obj.userData.base = obj.scale.clone();
    this.items.push({ obj, d });
    return obj;
  }
  factor(t, d = 0) {
    let s = 0;
    for (const [a, b] of this.windows) s = Math.max(s, pop(t, a, b, d, 0.5));
    return s;
  }
  update(t) {
    for (const { obj, d } of this.items) {
      const s = this.factor(t, d);
      obj.visible = s > 0.002;
      obj.scale.copy(obj.userData.base).multiplyScalar(Math.max(s, 0.0001));
    }
  }
}

// Polyline path sampled by arc length.
export class Path {
  constructor(pts) {
    this.pts = pts.map(p => new THREE.Vector3(...p));
    this.len = [0];
    for (let i = 1; i < this.pts.length; i++) this.len.push(this.len[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.total = this.len[this.len.length - 1];
  }
  at(u, out = new THREE.Vector3()) {
    const d = clamp(u) * this.total;
    let i = 1;
    while (i < this.len.length - 1 && this.len[i] < d) i++;
    const k = (d - this.len[i - 1]) / Math.max(1e-6, this.len[i] - this.len[i - 1]);
    return out.lerpVectors(this.pts[i - 1], this.pts[i], clamp(k));
  }
  dir(u) {
    const a = this.at(u - 0.01), b = this.at(u + 0.01);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
