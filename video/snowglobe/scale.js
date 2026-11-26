// Beat 8: globes multiply on the table, then the table becomes Hokkaido, then Japan, and cities light up.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { C, mat, mesh, rbox, glow, glowTexture, rng, clamp, prog, ease, lerp, pop } from './lib.js';
import { makeGlass, makeBase, TABLE_Y } from './globe.js';

const S = 200, COS = Math.cos(43 * Math.PI / 180);
export const proj = (lon, lat) => [(lon - 141.3545) * S * COS, -(lat - 43.0621) * S];
export const T8 = { globes: 25.9, map: 26.75, cities: 27.0, japan: 27.7, end: 28.45 };

function miniGlobe(k, rand) {
  const g = new THREE.Group();
  const r = 10 * k;
  g.add(makeBase(r, 3.6 * k));
  g.add(mesh(new THREE.CylinderGeometry(9.5 * k, 9.5 * k, 0.3 * k, 40), mat(C.snow), 0, -0.15 * k, 0, false));
  const inner = new THREE.Group(); inner.scale.setScalar(k); g.add(inner);
  const lit = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  inner.add(mesh(rbox(3.4, 1.0, 2.2), mat(0xc9d1de), 2.5 * (rand() - 0.5), 0.5, 0, false));
  inner.add(mesh(new THREE.PlaneGeometry(3.0, 0.5), lit, 2.5 * (rand() - 0.5), 0.5, 1.12, false));
  for (let i = 0; i < 5; i++) {
    const a = rand() * 6.28, d = 3 + rand() * 4;
    inner.add(mesh(rbox(1, 0.8 + rand(), 0.9), mat([0xd8c3a5, 0x8ea1c2, 0xc07a5e][i % 3]), Math.cos(a) * d, 0.5, Math.sin(a) * d, false));
  }
  inner.add(mesh(new THREE.ConeGeometry(0.4, 4, 4), mat(0xc8643a), -1, 2, -3, false));
  const gw = glow(0xffb860, 14, 0.8); gw.position.y = 1.5; inner.add(gw);
  const glass = makeGlass(r, -3 * k); glass.position.y = 3 * k; g.add(glass);
  return g;
}

function shapeFrom(ring) {
  return new THREE.Shape(ring.map(([lo, la]) => { const [x, z] = proj(lo, la); return new THREE.Vector2(x, -z); }));
}

export async function createScale(scene) {
  const [hk, jp, places] = await Promise.all(['hokkaido', 'japan', 'places'].map(n => fetch(`../shared/geo/${n}.json`).then(r => r.json())));
  const root = new THREE.Group(); scene.add(root);
  const rand = rng(33);

  // Mini globes around the main one
  const minis = [];
  const ring = (n, rad, k, t0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.3, rr = rad + (rand() - 0.5) * 6;
      const g = miniGlobe(k, rand);
      g.position.set(Math.sin(a) * rr, TABLE_Y + 3.6 * k, Math.cos(a) * rr * 0.9 - 4);
      g.userData.t0 = t0 + (i / n) * 0.35 + rand() * 0.05;
      g.userData.k = k;
      root.add(g); minis.push(g);
    }
  };
  ring(7, 25, 0.58, T8.globes);
  ring(12, 43, 0.5, T8.globes + 0.3);

  // Map
  const mapY = TABLE_Y + 0.03;
  const fillMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false });
  const hkFill = fillMat(0x22355e), jpFill = fillMat(0x1a2a4e);
  const lineMat = (c, w) => new LineMaterial({ color: c, linewidth: w, transparent: true, opacity: 0, depthWrite: false });
  const hkLine = lineMat(0xcfe2ff, 2.6), jpLine = lineMat(0x9fb8e8, 1.6);
  const addRing = (r, fm, lm, minLen = 3) => {
    if (r.length < minLen) return;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(r)), fm);
    m.rotation.x = -Math.PI / 2; m.position.y = mapY; m.renderOrder = -1; root.add(m);
    const pos = []; for (const [lo, la] of [...r, r[0]]) { const [x, z] = proj(lo, la); pos.push(x, mapY + 0.05, z); }
    const lg = new LineGeometry(); lg.setPositions(pos);
    const l = new Line2(lg, lm); l.computeLineDistances(); l.renderOrder = 0; root.add(l);
  };
  hk.rings.forEach(r => addRing(r, hkFill, hkLine));
  jp.prefectures.filter(p => !/hokkai/i.test(p.name)).forEach(p => p.rings.forEach(r => addRing(r, jpFill, jpLine, 8)));

  // City lights (screen-sized glows) with pulse rings
  const cityLight = (lon, lat, t0, size, ring = true) => {
    const [x, z] = proj(lon, lat);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc66b, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    s.position.set(x, mapY + 1, z); s.renderOrder = 20; root.add(s);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    ringM.rotation.x = -Math.PI / 2; ringM.position.set(x, mapY + 0.5, z); ringM.renderOrder = 19; root.add(ringM);
    if (!ring) ringM.visible = false;
    return { s, ringM, t0, size };
  };
  const lights = [
    cityLight(...places['Sapporo'], T8.cities, 0.11),
    cityLight(...places['Hakodate'], T8.cities + 0.25, 0.085),
    cityLight(...places['Obihiro'], T8.cities + 0.4, 0.085),
    cityLight(...places['Asahikawa'], T8.cities + 0.5, 0.07),
  ];
  const big = ['Tokyo', 'Osaka', 'Fukuoka'];
  big.forEach((n, i) => lights.push(cityLight(...places[n], T8.japan + 0.2 + i * 0.1, 0.085)));
  jp.prefectures.filter(p => !/hokkai/i.test(p.name)).forEach((p) => {
    const r = p.rings.reduce((a, b) => (b.length > a.length ? b : a));
    const c = r.reduce((a, [lo, la]) => [a[0] + lo / r.length, a[1] + la / r.length], [0, 0]);
    lights.push(cityLight(c[0], c[1], T8.japan + 0.3 + rand() * 0.45, 0.04, false));
  });

  return {
    root,
    setResolution(w, h) { for (const m of [hkLine, jpLine]) m.resolution.set(w, h); },
    update(t, camDist) {
      root.visible = t > T8.globes - 0.1;
      if (!root.visible) return;
      const fadeAll = 1 - ease.inOut(prog(t, T8.end, T8.end + 0.5));
      minis.forEach(g => {
        const s = pop(t, g.userData.t0, null, 0, 0.5);
        g.visible = s > 0.002; g.scale.setScalar(Math.max(1e-4, s));
      });
      const mf = ease.inOut(prog(t, T8.map, T8.map + 0.45)) * fadeAll, jf = ease.inOut(prog(t, T8.japan, T8.japan + 0.45)) * fadeAll;
      hkFill.opacity = mf * 0.95; hkLine.opacity = mf; jpFill.opacity = jf * 0.9; jpLine.opacity = jf * 0.75;
      for (const L of lights) {
        const u = prog(t, L.t0, L.t0 + 0.35);
        L.s.material.opacity = ease.out(u) * fadeAll;
        L.s.scale.setScalar(L.size * (u > 0 ? 1 + 0.6 * (1 - ease.out(u)) : 0) + 1e-5);
        const pr = prog(t, L.t0, L.t0 + 0.9);
        L.ringM.material.opacity = pr > 0 && pr < 1 ? (1 - pr) * 0.8 * fadeAll : 0;
        L.ringM.scale.setScalar(Math.max(1e-4, camDist * (0.01 + ease.out(pr) * 0.06) * (L.size / 0.085)));
      }
    },
  };
}
