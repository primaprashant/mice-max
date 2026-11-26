// Island surface: painted top texture, low-poly mountains and pine forests.
import * as THREE from 'three';
import { proj, onIsland, islandBounds } from './geo.js';
import { rng } from './util.js';

// Mountain ranges: [lon, lat, spread (world units), count, max height].
const RANGES = [
  [142.85, 43.66, 9, 14, 6.5],   // Daisetsuzan
  [142.65, 43.35, 6, 8, 5],      // Tokachi range
  [142.75, 42.75, 7, 16, 5],     // Hidaka (long ridge)
  [143.0, 42.4, 5, 8, 4],
  [140.81, 42.83, 1.5, 1, 5.2],  // Yotei
  [144.05, 43.42, 5, 6, 4],      // Akan
  [145.05, 44.05, 4, 6, 3.6],    // Shiretoko
  [141.0, 42.95, 3, 5, 2.4],     // hills west of Jozankei
  [140.4, 42.2, 5, 7, 2.6],      // Oshima
  [142.1, 44.4, 9, 9, 2.6],      // north hills
];
const CITY_CLEAR = (x, z) => x > -7.5 && x < 8 && z > -3 && z < 5.5; // keep the Sapporo diorama free

export function paintTop() {
  const b = islandBounds(), W = 1024, H = Math.round(1024 * (b.z1 - b.z0) / (b.x1 - b.x0));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), R = rng(3);
  const px = (x, z) => [(x - b.x0) / (b.x1 - b.x0) * W, (z - b.z0) / (b.z1 - b.z0) * H];
  const s = W / (b.x1 - b.x0);
  g.fillStyle = '#a9d79b'; g.fillRect(0, 0, W, H);
  // Soft colour variation.
  for (let i = 0; i < 260; i++) {
    const [x, y] = [R() * W, R() * H], r = 10 + R() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c0 = ['#b8e0a4', '#9dcf92', '#c3e5ae', '#93c98c'][i % 4];
    gr.addColorStop(0, c0); gr.addColorStop(1, 'rgba(169,215,155,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // Farmland patchwork: Tokachi, Furano/Biei, Ishikari plain.
  for (const [lo, la, n, sp] of [[143.2, 42.95, 90, 16], [142.45, 43.5, 40, 7], [141.6, 43.3, 40, 8], [141.9, 43.75, 30, 7]]) {
    const [cx, cz] = proj(lo, la);
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * 2 * sp, z = cz + (R() - 0.5) * 2 * sp;
      if (!onIsland(x, z) || CITY_CLEAR(x, z)) continue;
      const [X, Y] = px(x, z), w = (1.2 + R() * 2.2) * s, h = (1 + R() * 1.8) * s;
      g.fillStyle = ['#d9e8a6', '#bfe0a0', '#e8e2b0', '#a6d391', '#cfe7b8', '#f1efe0'][Math.floor(R() * 6)];
      g.save(); g.translate(X, Y); g.rotate(0.35); g.fillRect(-w / 2, -h / 2, w, h); g.restore();
    }
  }
  // Snow fields around the ranges and across the north-east.
  const snow = (x, z, r, a) => {
    const [X, Y] = px(x, z), gr = g.createRadialGradient(X, Y, 0, X, Y, r * s);
    gr.addColorStop(0, `rgba(250,252,255,${a})`); gr.addColorStop(1, 'rgba(250,252,255,0)');
    g.fillStyle = gr; g.fillRect(X - r * s, Y - r * s, 2 * r * s, 2 * r * s);
  };
  for (const [lo, la, sp] of RANGES) { const [x, z] = proj(lo, la); snow(x, z, sp * 1.6, 0.9); }
  for (let i = 0; i < 70; i++) {
    const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 + R() * (b.z1 - b.z0);
    if (!CITY_CLEAR(x, z) && Math.hypot(x, z) > 14) snow(x, z, 3 + R() * 8, 0.55);
  }
  // Sapporo: pale town ground.
  const [X, Y] = px(0.5, 0.8), gr = g.createRadialGradient(X, Y, 0, X, Y, 9 * s);
  gr.addColorStop(0, '#f3f5f2'); gr.addColorStop(0.55, '#eef3ea'); gr.addColorStop(1, 'rgba(238,243,234,0)');
  g.fillStyle = gr; g.fillRect(X - 9 * s, Y - 9 * s, 18 * s, 18 * s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// Low-poly cones with snowy tips, as two instanced meshes.
function coneGeo(seg, jitter, seed) {
  const g = new THREE.ConeGeometry(1, 1, seg, 2); g.translate(0, 0.5, 0);
  const R = rng(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.99) {
    p.setX(i, p.getX(i) * (1 + (R() - 0.5) * jitter)); p.setZ(i, p.getZ(i) * (1 + (R() - 0.5) * jitter));
  }
  return g.toNonIndexed();
}

export function buildMountains() {
  const R = rng(11), items = [];
  for (const [lo, la, sp, n, hmax] of RANGES) {
    const [cx, cz] = proj(lo, la);
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * 2 * sp, z = cz + (R() - 0.5) * 2 * sp * (lo === 142.75 ? 1.6 : 1);
      if (!onIsland(x, z) || CITY_CLEAR(x, z)) continue;
      const h = hmax * (0.45 + R() * 0.55);
      items.push([x, z, h, h * (1.1 + R() * 0.5), R() * 6]);
    }
  }
  const body = new THREE.InstancedMesh(coneGeo(7, 0.35, 1), new THREE.MeshLambertMaterial({ color: 0x8fae93, flatShading: true }), items.length);
  const cap = new THREE.InstancedMesh(coneGeo(7, 0.35, 1), new THREE.MeshLambertMaterial({ color: 0xf7f9fc, flatShading: true }), items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach(([x, z, h, r, rot], i) => {
    q.setFromEuler(e.set(0, rot, 0));
    m.compose(new THREE.Vector3(x, -0.01, z), q, new THREE.Vector3(r, h, r)); body.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, h * 0.52, z), q, new THREE.Vector3(r * 0.49, h * 0.49, r * 0.49)); cap.setMatrixAt(i, m);
  });
  body.castShadow = cap.castShadow = true; body.receiveShadow = true;
  const g = new THREE.Group(); g.add(body, cap); return g;
}

// Pine trees: a dark cone with a snowy tip. pts = [[x, z, scale]].
export function buildTrees(pts) {
  const geo = coneGeo(6, 0.2, 2), trunk = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 5); trunk.translate(0, 0.15, 0);
  const leaf = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x4f8f6a, flatShading: true }), pts.length);
  const tip = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xf4f7fb, flatShading: true }), pts.length);
  const stem = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: 0x8a6248 }), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  pts.forEach(([x, z, s], i) => {
    m.compose(v.set(x, 0.25 * s, z), q, sc.set(0.42 * s, 1.1 * s, 0.42 * s)); leaf.setMatrixAt(i, m);
    m.compose(v.set(x, 0.95 * s, z), q, sc.set(0.2 * s, 0.42 * s, 0.2 * s)); tip.setMatrixAt(i, m);
    m.compose(v.set(x, 0, z), q, sc.set(s, s, s)); stem.setMatrixAt(i, m);
  });
  leaf.castShadow = tip.castShadow = true;
  const g = new THREE.Group(); g.add(leaf, tip, stem); return g;
}

// Forest scatter over the whole island (small, far trees) avoiding the city.
export function islandForest() {
  const b = islandBounds(), R = rng(5), pts = [];
  while (pts.length < 1000) {
    const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 + R() * (b.z1 - b.z0);
    if (onIsland(x, z) && !CITY_CLEAR(x, z) && Math.hypot(x - 0.5, z - 1) > 13) pts.push([x, z, 0.7 + R() * 0.7]);
  }
  return buildTrees(pts);
}
