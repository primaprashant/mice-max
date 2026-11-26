// Map projection and the floating Hokkaido island (plus the rest of Japan for the final pull-out).
import * as THREE from 'three';
import { mergeGeometries } from '/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './util.js';

export const K = 40; // world units per degree of latitude
const LON0 = 141.3545, LAT0 = 43.0621, CX = Math.cos(LAT0 * Math.PI / 180);
// lon/lat -> world [x, z] (x east, z south).
export const proj = (lon, lat) => [(lon - LON0) * CX * K, -(lat - LAT0) * K];

const load = p => fetch(p).then(r => r.json());
export const geo = { hokkaido: null, japan: null, places: null };
export async function loadGeo() {
  [geo.hokkaido, geo.japan, geo.places] = await Promise.all(
    ['hokkaido', 'japan', 'places'].map(n => load(`../shared/geo/${n}.json`)));
  geo.place = n => proj(...geo.places[n]);
}

// Shape in XY where y = north (so rotating -90deg about X puts it on the ground).
function shapeOf(ring) {
  const pts = ring.map(([lo, la]) => { const [x, z] = proj(lo, la); return new THREE.Vector2(x, -z); });
  return new THREE.Shape(pts);
}

// Point-in-polygon on the main island ring, in world x/z.
export function onIsland(x, z) {
  const ring = mainRing();
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
let _main;
export function mainRing() {
  if (!_main) {
    const r = geo.hokkaido.rings.reduce((a, b) => (b.length > a.length ? b : a));
    _main = r.map(p => proj(...p));
  }
  return _main;
}

// Island: grass top (painted texture), soil sides, and a rocky cone underneath.
export function buildIsland(topTex) {
  const g = new THREE.Group();
  const depth = 2.0;
  const shapes = geo.hokkaido.rings.filter(r => r.length > 8).map(shapeOf);
  const geom = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 });
  geom.rotateX(-Math.PI / 2); geom.translate(0, -depth, 0);
  // Planar UVs over the island bounds so the painted texture lines up with world x/z.
  const b = islandBounds();
  const pos = geom.attributes.position, uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++)
    uv.setXY(i, (pos.getX(i) - b.x0) / (b.x1 - b.x0), 1 - (pos.getZ(i) - b.z0) / (b.z1 - b.z0));
  const top = new THREE.MeshLambertMaterial({ map: topTex });
  const side = new THREE.MeshLambertMaterial({ color: 0x9a7356 });
  const mesh = new THREE.Mesh(geom, [top, side]);
  mesh.receiveShadow = true;
  g.add(mesh);
  g.add(underside(depth));
  return g;
}

export function islandBounds() {
  const r = mainRing(); const xs = r.map(p => p[0]), zs = r.map(p => p[1]);
  return { x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, z0: Math.min(...zs) - 1, z1: Math.max(...zs) + 1 };
}

// Rocky roots under the island: jittered cones kept inside the coastline so they never show from above.
const ROOTS = [[142.7, 43.6, 30], [142.0, 44.6, 14], [144.3, 43.4, 17], [140.45, 42.15, 8], [141.85, 43.2, 10], [143.2, 42.6, 10]];
function underside(depth) {
  const R = rng(7), parts = [];
  for (const [lo, la, r] of ROOTS) {
    const [x, z] = proj(lo, la);
    const g = new THREE.ConeGeometry(r, r * 1.25, 8, 3); g.rotateX(Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < r * 0.62 && y > -r * 0.62) { p.setX(i, p.getX(i) * (0.85 + R() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + R() * 0.3)); p.setY(i, y + (R() - 0.5) * r * 0.15); }
    }
    g.translate(x, -depth - r * 0.625 + 0.01, z);
    parts.push(g.toNonIndexed());
  }
  const geom = mergeGeometries(parts);
  const cols = [], c0 = new THREE.Color(0x8c6a50), c1 = new THREE.Color(0x4f4240), pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, k = Math.min(1, -y / 30);
    const c = c0.clone().lerp(c1, k).offsetHSL(0, 0, (R() - 0.5) * 0.06);
    for (let j = 0; j < 3; j++) cols.push(c.r, c.g, c.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

// Rest of Japan as one thin slab, for the last pull-out.
export function buildJapan() {
  const shapes = [];
  for (const p of geo.japan.prefectures) {
    if (p.name.startsWith('Hokkai')) continue;
    for (const r of p.rings) if (r.length > 4) shapes.push(shapeOf(r));
  }
  const geom = new THREE.ExtrudeGeometry(shapes, { depth: 3, bevelEnabled: false, curveSegments: 1 });
  geom.rotateX(-Math.PI / 2); geom.translate(0, -3.6, 0);
  const mat = [new THREE.MeshLambertMaterial({ color: 0xb9dfa8, transparent: true }),
    new THREE.MeshLambertMaterial({ color: 0x9a7356, transparent: true })];
  return new THREE.Mesh(geom, mat);
}
