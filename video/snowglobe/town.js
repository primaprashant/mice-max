// Miniature winter Sapporo inside the globe: convention center, TV tower, airport, shops, onsen, ramen, Mt Moiwa.
import * as THREE from 'three';
import { C, mat, mesh, rbox, glow, rng, canvasTexture, Stage } from './lib.js';
import { snowyTree } from './globe.js';

export const SPOT = {
  conventionDoor: [4.2, 0, 0.9],
  onsen: [2.4, 0, -3.7], ramen: [-0.75, 0, 4.4], moiwa: [-3.6, 3.0, -5.4], moiwaBase: [-2.2, 0, -3.3],
};

const winTex = canvasTexture(64, 64, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  for (const [x, y] of [[8, 8], [36, 8], [8, 36], [36, 36]]) g.fillRect(x, y, 20, 20);
});

function emissive(color, unique = true) {
  return new THREE.MeshLambertMaterial({ color: 0x141a2c, emissive: color, emissiveIntensity: 0 });
}

function house(w, h, d, wall, winMat) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, h, d, 0.05), mat(wall), 0, h / 2, 0));
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.12, 0), new THREE.Vector2(w / 2 + 0.12, 0), new THREE.Vector2(0, w * 0.48)]);
  const roof = mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 0.2, bevelEnabled: false }), mat(C.snow), 0, h, -d / 2 - 0.1);
  const eave = mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 0.16, bevelEnabled: false }), mat(0x3b2a26), 0, h - 0.06, -d / 2 - 0.08);
  g.add(roof, eave);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, h * 0.55), winMat);
  win.position.set(0, h * 0.52, d / 2 + 0.006);
  g.add(win);
  return g;
}

function leg(a, b, m, th = 0.06) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const l = mesh(new THREE.BoxGeometry(th, th, A.distanceTo(B)), m);
  l.position.copy(A).add(B).multiplyScalar(0.5);
  l.lookAt(B);
  return l;
}

export function createTown(interior, windows) {
  const g = new THREE.Group();
  interior.add(g);
  const stage = new Stage(windows);
  const add = (o, d) => { g.add(o); stage.add(o, d); return o; };
  const rand = rng(21);

  const m = {
    shops: emissive(C.amber), onsen: emissive(0xffa860), ramen: emissive(0xff5a36), moiwa: emissive(C.warm),
    conv: emissive(C.warm),
  };
  for (const k of ['shops', 'conv']) { m[k].emissiveMap = winTex; m[k].color.set(0x10162a); }
  m.conv.emissiveIntensity = 1.6;
  const glows = { shops: [], onsen: [], ramen: [], moiwa: [] };

  // Roads (compacted snow)
  const road = mat(0xb9c6dc);
  add(mesh(new THREE.BoxGeometry(9.2, 0.04, 0.9), road, -0.2, 0.01, 2.75), 0);
  add(mesh(new THREE.BoxGeometry(0.9, 0.04, 2.2), road, 4.2, 0.012, 1.8), 0);

  // Airport: runway, edge lights, terminal
  const runway = new THREE.Group(); runway.position.set(-5.7, 0, -0.6);
  runway.add(mesh(new THREE.BoxGeometry(1.25, 0.05, 8.2), mat(0x2b3550), 0, 0.03, 0));
  for (let i = 0; i < 9; i++) runway.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.4), mat(C.snow), 0, 0.04, -3.6 + i * 0.9, false));
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    const gl = glow(i % 2 ? 0x7fb6ff : C.amber, 0.28, 0.9); gl.position.set(s * 0.7, 0.1, -3.7 + i * 1.05); runway.add(gl);
  }
  add(runway, 0.05);
  const term = new THREE.Group(); term.position.set(-3.9, 0, 0.8);
  term.add(mesh(rbox(1.5, 0.6, 1.0), mat(0xd8dde8), 0, 0.3, 0));
  const tw = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.22), m.conv); tw.position.set(0, 0.36, 0.505); term.add(tw);
  term.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8), mat(0xd8dde8), -0.5, 0.6, -0.3));
  term.add(mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.22, 8), mat(0x2b3550, { emissive: 0x3a6aa8 }), -0.5, 1.28, -0.3));
  add(term);

  // Convention center: long hall with a curved snowy roof and a lit glass front.
  const conv = new THREE.Group(); conv.position.set(4.9, 0, -0.4);
  conv.add(mesh(rbox(3.4, 0.95, 2.2), mat(0xc9d1de), 0, 0.475, 0));
  const vault = mesh(new THREE.CylinderGeometry(1.15, 1.15, 3.5, 32, 1, false, 0, Math.PI), mat(C.snow), 0, 0.95, 0);
  vault.rotation.set(0, 0, Math.PI / 2); vault.scale.set(0.45, 1, 0.96);
  conv.add(vault);
  const cw = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), m.conv); cw.position.set(0, 0.5, 1.105); conv.add(cw);
  conv.add(mesh(rbox(0.9, 0.08, 0.5), mat(0x3a4a6b), -0.7, 0.75, 1.3));
  const cg = glow(C.warm, 4.5, 0.55); cg.position.set(0, 0.6, 1.4); conv.add(cg);
  add(conv);

  // TV tower: tapering lattice, deck, glowing clock, red beacon.
  const tv = new THREE.Group(); tv.position.set(0.3, 0, -3.4);
  const steel = mat(0xc8643a);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    tv.add(leg([sx * 0.55, 0, sz * 0.55], [sx * 0.14, 2.6, sz * 0.14], steel, 0.07));
    tv.add(leg([sx * 0.4, 0.8, sz * 0.4], [-sx * 0.3, 1.6, sz * 0.3], steel, 0.04));
  }
  tv.add(mesh(rbox(0.75, 0.32, 0.75, 0.05), mat(0xdfe4ee), 0, 2.2, 0));
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ color: 0xbff4ff }));
  clock.position.set(0, 1.7, 0.33); tv.add(clock);
  tv.add(mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.4, 6), steel, 0, 3.2, 0));
  const beacon = glow(0xff4030, 0.6, 1); beacon.position.y = 3.95; tv.add(beacon);
  add(tv);

  // Shops along the street
  const walls = [0xd8c3a5, 0x8ea1c2, 0xc07a5e, 0xe2d7c6, 0x9fb59a];
  for (let i = 0; i < 5; i++) {
    const w = 0.9 + rand() * 0.25, h = 0.75 + rand() * 0.45;
    const hs = house(w, h, 0.8, walls[i], m.shops);
    hs.position.set(-2.5 + i * 1.12, 0, 1.05 + (rand() - 0.5) * 0.25);
    add(hs);
    const gl = glow(C.amber, 1.8, 0); gl.position.set(hs.position.x, h * 0.55, hs.position.z + 0.6); g.add(gl); glows.shops.push(gl);
  }

  // Onsen ryokan with a steaming pool
  const ons = new THREE.Group(); ons.position.set(3.5, 0, -5.4); ons.rotation.y = -0.25;
  ons.add(mesh(rbox(1.9, 0.75, 1.2), mat(0x6a4535), 0, 0.375, 0));
  const hip = mesh(new THREE.ConeGeometry(1.55, 0.6, 4), mat(C.snow), 0, 1.05, 0); hip.rotation.y = Math.PI / 4; hip.scale.z = 0.7;
  ons.add(hip);
  const ow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), m.shops); ow.position.set(0, 0.42, 0.605); ons.add(ow);
  add(ons);
  const pool = new THREE.Group(); pool.position.set(SPOT.onsen[0], 0, SPOT.onsen[2]);
  pool.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 28), m.onsen, 0, 0.04, 0, false));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const rk = mesh(new THREE.DodecahedronGeometry(0.17 + rand() * 0.06), mat(0x4a5060), Math.cos(a) * 0.92, 0.08, Math.sin(a) * 0.92);
    pool.add(rk);
  }
  add(pool);
  const og = glow(0xffa860, 3.2, 0); og.position.set(pool.position.x, 0.4, pool.position.z); g.add(og); glows.onsen.push(og);
  const steam = [];
  for (let i = 0; i < 9; i++) {
    const s = glow(0xffffff, 0.9, 0); s.material.blending = THREE.NormalBlending; s.material.color.set(0xe8eefc);
    s.userData.seed = [rand(), rand(), rand()]; g.add(s); steam.push(s);
  }

  // Ramen stalls (yatai) with red lanterns
  for (const [x, z, ry] of [[-1.5, 4.3, 0.12], [0.0, 4.45, -0.08]]) {
    const y = new THREE.Group(); y.position.set(x, 0, z); y.rotation.y = ry; y.scale.setScalar(0.78);
    y.add(mesh(rbox(1.0, 0.48, 0.55), mat(0x7a3324), 0, 0.3, 0));
    y.add(mesh(new THREE.BoxGeometry(1.08, 0.05, 0.66), mat(0xd9b48a), 0, 0.56, 0));
    for (const sx of [-0.48, 0.48]) y.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), mat(0x2a1e1a), sx, 0.85, -0.2));
    const rf = mesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), mat(C.snow), 0, 1.17, 0); rf.rotation.x = 0.18; y.add(rf);
    y.add(mesh(new THREE.BoxGeometry(1.0, 0.18, 0.02), mat(0x23304d), 0, 1.02, 0.32));
    for (const sx of [-0.32, 0.32]) {
      y.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), m.ramen, sx, 0.85, 0.36, false));
      const lg = glow(0xff6a3d, 1.0, 0); lg.position.set(x + sx * 0.78, 0.66, z + 0.3); g.add(lg); glows.ramen.push(lg);
    }
    for (const sx of [-0.25, 0.25]) y.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 8), mat(0x2a1e1a), sx, 0.12, 0.45));
    add(y);
  }

  // Mt Moiwa with a summit observatory and ropeway lights
  const mo = new THREE.Group(); mo.position.set(SPOT.moiwa[0], 0, SPOT.moiwa[2]);
  const mountain = mesh(new THREE.ConeGeometry(2.7, 3.0, 9, 3), mat(0x2d4b5a, { flatShading: true }), 0, 1.5, 0);
  mo.add(mountain);
  mo.add(mesh(new THREE.ConeGeometry(1.15, 1.25, 9, 1), mat(C.snow, { flatShading: true }), 0, 2.4, 0));
  mo.add(mesh(rbox(0.5, 0.22, 0.4), mat(0xdfe4ee), 0, 3.0, 0));
  const ml = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), m.moiwa); ml.position.set(0, 3.02, 0.205); mo.add(ml);
  add(mo, 0.1);
  const mg = glow(C.warm, 2.6, 0); mg.position.set(SPOT.moiwa[0], 3.1, SPOT.moiwa[2] + 0.3); g.add(mg); glows.moiwa.push(mg);
  for (let i = 0; i < 6; i++) {
    const k = (i + 1) / 7;
    const lg = glow(C.warm, 0.3, 0);
    lg.position.set(SPOT.moiwa[0] + 1.9 * (1 - k) + 0.2, 0.3 + k * 2.6, SPOT.moiwa[2] + 1.9 * (1 - k) + 0.25);
    g.add(lg); glows.moiwa.push(lg);
  }

  // Street lamps and town trees
  for (const x of [-3.0, -0.8, 1.2, 3.4]) {
    const l = new THREE.Group(); l.position.set(x, 0, 3.35);
    l.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 6), mat(0x2a2f3d), 0, 0.4, 0));
    l.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), 0, 0.82, 0, false));
    const lg = glow(C.warm, 0.8, 0.7); lg.position.y = 0.82; l.add(lg);
    add(l);
  }
  for (const [x, z, s] of [[2.0, -1.7, 0.8], [-1.6, -2.1, 0.8], [5.6, -4.4, 1.1], [-0.9, -5.9, 1.0], [6.9, -2.2, 0.8], [-6.8, -4.6, 0.9],
    [4.6, -2.6, 0.8], [-2.2, 4.4, 0.7], [-4.6, 4.2, 0.8], [6.3, 2.6, 0.8]]) {
    const tr = snowyTree(rand, s); tr.position.set(x, 0, z); add(tr);
  }

  const lit = { shops: 0, onsen: 0, ramen: 0, moiwa: 0 };
  return {
    group: g, stage, lit,
    update(t) {
      stage.update(t);
      const f = stage.factor(t);
      m.shops.emissiveIntensity = lit.shops * 1.7;
      m.onsen.emissiveIntensity = lit.onsen * 1.3;
      m.ramen.emissiveIntensity = 0.05 + lit.ramen * 2.2;
      m.moiwa.emissiveIntensity = lit.moiwa * 2;
      for (const k in glows) for (const gl of glows[k]) gl.material.opacity = lit[k] * f * 0.85;
      steam.forEach((s, i) => {
        const [a, b, c] = s.userData.seed;
        const ph = (t * 0.35 + a) % 1;
        s.position.set(pool.position.x + (b - 0.5) * 1.1 + Math.sin(t + i) * 0.1, 0.2 + ph * 1.8, pool.position.z + (c - 0.5) * 0.9);
        s.scale.setScalar(0.5 + ph * 1.1);
        s.material.opacity = lit.onsen * f * 0.35 * Math.sin(ph * Math.PI);
      });
    },
  };
}
