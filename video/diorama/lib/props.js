// Toy buildings and vehicles, all built from simple primitives.
import * as THREE from 'three';

const mats = new Map();
export const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color, ...o }));
  return mats.get(k);
};
// A material that can glow warm when its place is "lit".
export const litMat = (dark = 0x56606e, glow = 0xffc46b) =>
  new THREE.MeshLambertMaterial({ color: dark, emissive: glow, emissiveIntensity: 0 });
export const setLit = (m, k) => { m.emissiveIntensity = k * 1.25; };

export function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m);
  o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o;
}
// Box resting on y (bottom at y).
export const box = (w, h, d, m, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
export const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
export const ball = (r, m, x = 0, y = 0, z = 0, seg = 10) => mesh(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)), m, x, y, z);

// Hip roof: 4-sided pyramid stretched to w x d.
export function hipRoof(w, h, d, m, y) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(Math.PI / 4);
  const o = mesh(g, m, 0, y + h / 2, 0); o.scale.set(w, h, d); return o;
}
// Gable roof prism along x.
export function gable(w, h, d, m, y) {
  const s = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
  return mesh(g, m, 0, y, 0);
}

export function conventionCenter() {
  const g = new THREE.Group(), glass = litMat(0x9cc7e0, 0xffd28a);
  g.add(box(2.1, 0.06, 1.5, 0xe9e6df));
  g.add(box(1.7, 0.34, 1.0, 0xf6f5f2, 0, 0.06, -0.05));
  g.add(box(1.5, 0.22, 0.02, glass, 0, 0.08, 0.46));
  const roof = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 16, 1, false, 0, Math.PI), 0xbfd8e6, 0, 0.4, -0.05);
  roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(0.42, 1, 1.0);
  g.add(roof);
  g.add(box(0.6, 0.03, 0.3, 0xffffff, 0, 0.3, 0.6));
  [[-0.2, 0xff8a7a], [0, 0xffc857], [0.2, 0x7cc6ff]].forEach(([x, c]) => {
    g.add(cyl(0.008, 0.008, 0.36, 0xdddddd, x - 0.55, 0.06, 0.66, 5));
    g.add(box(0.12, 0.07, 0.01, c, x - 0.55 + 0.06, 0.32, 0.66));
  });
  g.userData.glass = glass;
  return g;
}

export function tvTower() {
  const g = new THREE.Group(), red = 0xf07a4f;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = box(0.035, 1.0, 0.035, red); leg.position.set(sx * 0.13, 0.5, sz * 0.13);
    leg.rotation.set(-sz * 0.12, 0, sx * 0.12); g.add(leg);
  }
  for (const y of [0.25, 0.5]) g.add(box(0.26 - y * 0.2, 0.03, 0.26 - y * 0.2, red, 0, y, 0));
  g.add(box(0.2, 0.09, 0.03, 0xffffff, 0, 0.52, 0.09));
  g.add(box(0.2, 0.12, 0.2, 0xd9e6ee, 0, 0.82, 0));
  g.add(cyl(0.012, 0.02, 0.5, red, 0, 0.94, 0, 6));
  return g;
}

export function ryokan() {
  const g = new THREE.Group(), win = litMat(0x6b5a4a, 0xffbf66);
  g.add(box(1.2, 0.08, 0.8, 0xb7b2a8));
  g.add(box(1.0, 0.24, 0.6, 0xf3ead8, 0, 0.08, 0));
  g.add(box(0.9, 0.1, 0.02, win, 0, 0.14, 0.305));
  g.add(hipRoof(1.25, 0.2, 0.85, 0x6a7488, 0.32));
  g.add(box(0.6, 0.18, 0.4, 0xf3ead8, 0, 0.42, 0));
  g.add(box(0.5, 0.08, 0.02, win, 0, 0.47, 0.205));
  g.add(hipRoof(0.8, 0.18, 0.6, 0x6a7488, 0.6));
  // Outdoor bath with rocks.
  const pool = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 14), litMat(0x8fd3d8, 0x9ff3ff), 0.55, 0.03, 0.62);
  g.add(pool);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2, r = ball(0.06, 0x9a9a92, 0.55 + Math.cos(a) * 0.3, 0.04, 0.62 + Math.sin(a) * 0.3, 5);
    r.scale.y = 0.7; g.add(r);
  }
  g.userData.win = win; g.userData.pool = pool.material; g.userData.poolPos = new THREE.Vector3(0.55, 0.06, 0.62);
  return g;
}

export function ramenBowl(r = 0.2) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, -Math.cos(a) * r * 0.8)); }
  const bowl = mesh(new THREE.LatheGeometry(pts, 16), mat(0xe8505b, { side: THREE.DoubleSide }));
  g.add(bowl);
  g.add(mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.01, 16), 0xf2c46d, 0, -0.02, 0));
  g.add(ball(r * 0.22, 0xffffff, r * 0.35, -0.01, 0.1 * r, 8));
  g.add(ball(r * 0.12, 0xffb52e, r * 0.35, 0.01, 0.1 * r, 8));
  g.add(box(r * 0.5, 0.01, r * 0.35, 0x7b4f3a, -r * 0.3, -0.03, -r * 0.2));
  for (const dz of [-0.03, 0.03]) {
    const c = box(0.012, r * 2, 0.012, 0xc89a62, -r * 0.4, 0, dz * r * 5); c.rotation.z = 0.7; g.add(c);
  }
  return g;
}

export function yatai() {
  const g = new THREE.Group(), lamp = litMat(0xd8464a, 0xff6a3d);
  g.add(box(0.7, 0.26, 0.4, 0x9b6b47));
  g.add(box(0.74, 0.03, 0.44, 0x7b4f3a, 0, 0.26));
  for (const x of [-0.33, 0.33]) g.add(box(0.03, 0.3, 0.03, 0x7b4f3a, x, 0.29, 0.18));
  const roof = box(0.84, 0.04, 0.6, 0xd8464a, 0, 0.59, 0.05); roof.rotation.x = 0.18; g.add(roof);
  for (let i = 0; i < 4; i++) g.add(box(0.15, 0.12, 0.01, 0x283a5c, -0.24 + i * 0.16, 0.45, 0.24));
  for (const x of [-0.42, 0.42]) { const l = ball(0.06, lamp, x, 0.5, 0.25, 8); l.scale.y = 1.3; g.add(l); }
  for (const x of [-0.2, 0, 0.2]) g.add(cyl(0.04, 0.04, 0.12, 0x7b4f3a, x, 0, 0.33, 8));
  const bowl = ramenBowl(0.16); bowl.position.set(0, 0.86, 0.05); g.add(bowl);
  g.userData.lamp = lamp;
  return g;
}

export function shop(color, seed = 0) {
  const g = new THREE.Group(), win = litMat(0x5e6672, 0xffd08a);
  const h = 0.36 + (seed % 3) * 0.08;
  g.add(box(0.5, h, 0.42, color));
  g.add(box(0.4, 0.14, 0.02, win, 0, 0.02, 0.215));
  g.add(box(0.3, 0.07, 0.02, win, 0, h - 0.13, 0.215));
  const aw = box(0.48, 0.02, 0.14, [0xff8a7a, 0x7cc6ff, 0xffc857, 0x9ad58a][seed % 4], 0, 0.18, 0.27); aw.rotation.x = 0.3; g.add(aw);
  const shutter = box(0.42, 0.16, 0.012, 0x9aa1ab, 0, 0.0, 0.228); g.add(shutter);
  g.add(gable(0.54, 0.14, 0.46, [0xd9785f, 0x6f9fc9, 0x7fae8a, 0xc98aa8, 0xe0a85a][seed % 5], h));
  g.userData.win = win; g.userData.shutter = shutter;
  return g;
}

export function cityHall() {
  const g = new THREE.Group(), brick = 0xc8644e, win = litMat(0x5e6672, 0xffd08a);
  g.add(box(1.4, 0.05, 0.8, 0xdedad2));
  g.add(box(1.2, 0.38, 0.55, brick, 0, 0.05, 0));
  g.add(box(1.0, 0.06, 0.02, win, 0, 0.14, 0.28)); g.add(box(1.0, 0.06, 0.02, win, 0, 0.28, 0.28));
  g.add(hipRoof(1.3, 0.16, 0.65, 0x55606e, 0.43));
  g.add(cyl(0.13, 0.15, 0.25, brick, 0, 0.5, 0, 8));
  g.add(mesh(new THREE.ConeGeometry(0.15, 0.2, 8), 0x55606e, 0, 0.85, 0));
  g.add(cyl(0.006, 0.006, 0.18, 0xdddddd, 0, 0.94, 0, 4));
  const star = box(0.08, 0.05, 0.01, 0xff5a4e, 0.04, 1.06, 0); g.add(star);
  g.userData.win = win;
  return g;
}

export function venue(color, h = 0.5, seed = 0) {
  const g = new THREE.Group(), glass = litMat(0x9cc7e0, 0xffd28a);
  const w = 0.55 + (seed % 3) * 0.12;
  g.add(box(w, h, 0.45, color));
  for (let y = 0.08; y < h - 0.08; y += 0.12) g.add(box(w * 0.86, 0.05, 0.01, glass, 0, y, 0.226));
  g.add(box(w + 0.04, 0.04, 0.49, 0xe9e6df, 0, h));
  g.userData.glass = glass;
  return g;
}

export function plane() {
  const g = new THREE.Group(), body = new THREE.Group();
  const f = mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 10), 0xffffff); f.rotation.x = Math.PI / 2; body.add(f);
  body.add(box(0.146, 0.03, 0.62, 0x4f8fe6, 0, -0.035, 0.02));
  const wing = box(0.82, 0.016, 0.13, 0xeef2f7, 0, -0.035, 0.04); body.add(wing);
  body.add(box(0.32, 0.014, 0.08, 0xeef2f7, 0, 0.0, -0.36));
  const fin = box(0.016, 0.16, 0.12, 0x4f8fe6, 0, 0.02, -0.37); fin.rotation.x = -0.35; body.add(fin);
  for (const x of [-0.22, 0.22]) { const e = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), 0xcfd6df, x, -0.06, 0.06); e.rotation.x = Math.PI / 2; body.add(e); }
  g.add(body);
  return g;
}

export function airport() {
  const g = new THREE.Group();
  g.add(box(6.2, 0.02, 0.5, 0x6d7480, 0, 0, 0));
  for (let i = 0; i < 14; i++) g.add(box(0.22, 0.004, 0.03, 0xffffff, -2.8 + i * 0.43, 0.02, 0));
  g.add(box(4.0, 0.015, 0.9, 0xd3d6dc, 0.6, 0, -0.65)); g.add(box(1.6, 0.015, 1.0, 0xd3d6dc, -1.9, 0, 0.8));
  const term = new THREE.Group(); term.position.set(1.0, 0, -1.0);
  term.add(box(2.4, 0.26, 0.5, 0xf6f5f2));
  term.add(box(2.3, 0.14, 0.02, litMat(0x9cc7e0, 0xffd28a), 0, 0.06, 0.26));
  const roof = mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.5, 14, 1, false, 0, Math.PI), 0xbfd8e6, 0, 0.26, 0);
  roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(0.25, 1, 0.72); term.add(roof);
  g.add(term);
  g.add(cyl(0.06, 0.08, 0.7, 0xf6f5f2, 2.7, 0, -1.0, 8));
  g.add(cyl(0.13, 0.1, 0.12, 0x9cc7e0, 2.7, 0.7, -1.0, 8));
  g.add(cyl(0.14, 0.14, 0.03, 0x6b7c93, 2.7, 0.82, -1.0, 8));
  return g;
}

// Many small houses as instanced walls + roofs + windows. pts = [[x, z, rotY, scale, colorIndex]].
export function houses(pts) {
  const walls = ['#f6efe4', '#e9f1f5', '#f9e3d6', '#e6efe0', '#f3f0f7'].map(c => new THREE.Color(c));
  const roofs = ['#7a8ca8', '#c4685a', '#6f9a86', '#8a7aa8', '#5d6b7d'].map(c => new THREE.Color(c));
  const wg = new THREE.BoxGeometry(0.3, 0.22, 0.26); wg.translate(0, 0.11, 0); wg.scale(0.7, 0.7, 0.7);
  const rs = new THREE.Shape([new THREE.Vector2(-0.16, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, 0.12)]);
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.34, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-0.17, 0.22, 0); rg.scale(0.7, 0.7, 0.7);
  const ng = new THREE.BoxGeometry(0.16, 0.06, 0.01); ng.translate(0, 0.12, 0.132); ng.scale(0.7, 0.7, 0.7);
  const W = new THREE.InstancedMesh(wg, new THREE.MeshLambertMaterial(), pts.length);
  const Rf = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial(), pts.length);
  const win = litMat(0x6c7684, 0xffc978);
  const N = new THREE.InstancedMesh(ng, win, pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  pts.forEach(([x, z, r, sc, c], i) => {
    q.setFromEuler(e.set(0, r, 0)); s.set(sc, sc * (1 + (c % 3) * 0.35), sc);
    m.compose(v.set(x, 0, z), q, s); W.setMatrixAt(i, m); N.setMatrixAt(i, m);
    W.setColorAt(i, walls[c % 5]);
    m.compose(v.set(x, 0.154 * sc * (1 + (c % 3) * 0.35) - 0.154 * sc, z), q, s.set(sc, sc, sc)); Rf.setMatrixAt(i, m);
    Rf.setColorAt(i, roofs[(c * 3) % 5]);
  });
  W.castShadow = Rf.castShadow = true; W.receiveShadow = true;
  const g = new THREE.Group(); g.add(W, Rf, N); g.userData.win = win; return g;
}

// Soft additive halo, used for "this place lights up".
let glowTex;
export function glow(color = 0xffc46b, size = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.setScalar(size); s.userData.size = size; return s;
}
export const setGlow = (s, k) => { s.visible = k > 0.01; s.material.opacity = k; s.scale.setScalar(s.userData.size * (0.6 + 0.4 * k)); };
