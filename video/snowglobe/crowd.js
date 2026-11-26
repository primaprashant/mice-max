// Attendees (instanced little figures with lanyards and suitcases) and the two planes.
import * as THREE from 'three';
import { C, mat, mesh, rbox, glow, rng, clamp, prog, ease, lerp, Path } from './lib.js';
import { SPOT } from './town.js';

export const N = 96;
const COATS = [0x2c3e66, 0x8c2f39, 0x3d5a4a, 0xc9893a, 0x4a4f5e, 0x6b4d7a, 0x22283a, 0xb55a3c];
const PLANE_STOP = [1.3, -1.4];

// Walking routes
const toConv = new Path([[-3.6, 0, 1.4], [-3.0, 0, 2.75], [4.2, 0, 2.75], [4.2, 0, 0.95]]);
const toPlane = [0, 1].map(k => new Path([[4.2, 0, 0.95], [4.2, 0, 2.75], [-3.0, 0, 2.75], [-3.6, 0, 1.6], [-5.0, 0, PLANE_STOP[k] + 0.2]]));
const toPlace = [
  new Path([[4.2, 0, 0.95], [2.95, 0, 0.55], [2.95, 0, -2.2], [2.4, 0, -3.7]]),
  new Path([[4.2, 0, 0.95], [4.2, 0, 2.75], [1.0, 0, 3.0], [-0.6, 0, 5.0]]),
  new Path([[4.2, 0, 0.95], [2.95, 0, 0.55], [2.95, 0, -1.2], [-0.9, 0, -2.0], [-1.8, 0, -3.4], [-2.9, 1.9, -4.4], [-3.4, 2.6, -4.9]]),
];

// Per-figure seeds
const rand = rng(5);
const F = Array.from({ length: N }, (_, i) => ({
  off: (rand() - 0.5) * 0.7, sp: 0.9 + rand() * 0.2, ph: rand() * 6, coat: COATS[i % COATS.length],
  grp: i % 3, a: rand() * Math.PI * 2, r: rand(),
}));
// Final spots at each place
F.forEach((f, i) => {
  if (f.grp === 0) { const a = f.a, r = 0.35 + f.r * 0.45; f.dest = [2.4 + Math.cos(a) * r, -0.16, -3.7 + Math.sin(a) * r]; }
  if (f.grp === 1) { const k = (i / 3) % 16; f.dest = [-2.15 + (k % 8) * 0.38 + (k >= 8 ? 0.19 : 0), 0, 4.95 + (k >= 8 ? 0.4 : 0)]; }
  if (f.grp === 2) {
    const a = -0.4 + f.r * 2.6, d = 0.55 + (i % 4) * 0.4;
    f.dest = [SPOT.moiwa[0] + Math.cos(a) * d, 3.0 * (1 - d / 2.7) - 0.02, SPOT.moiwa[2] + Math.sin(a) * d];
  }
});

const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3(), mtx = new THREE.Matrix4();

// State of figure i at time t: position, heading, scale, walking.
function state(i, t, out) {
  const f = F[i];
  out.walk = false; out.s = 1; out.luggage = 1;
  const along = (path, t0, dur, rev) => {
    const u = clamp((t - t0) / (dur / f.sp));
    path.at(u, out.p);
    const h = path.dir(u);
    out.h = h;
    out.p.x += Math.cos(h) * f.off; out.p.z -= Math.sin(h) * f.off;
    out.walk = u > 0 && u < 1;
    return u;
  };
  const k = i / N;
  if (t < 4.0) {
    const u = along(toConv, 0.8 + k * 0.85, 2.3);
    out.s = u <= 0 || u >= 1 ? 0 : Math.min(1, u * 25, (1 - u) * 25);
  } else if (t < 8) {
    const u = along(toPlane[i % 2], 4.0 + k * 0.5, 1.75);
    out.s = u <= 0 || u >= 1 ? 0 : Math.min(1, u * 25, (1 - u) * 25);
  } else {
    const u = along(toPlace[f.grp], 9.25 + k * 1.1, 1.9);
    out.luggage = 0;
    out.s = u <= 0 ? 0 : Math.min(1, u * 25);
    if (u >= 1) {
      const e = ease.inOut(prog(t, 9.25 + k * 1.1 + 1.9 / f.sp, 9.25 + k * 1.1 + 1.9 / f.sp + 0.5));
      out.p.set(lerp(out.p.x, f.dest[0], e), lerp(out.p.y, f.dest[1], e), lerp(out.p.z, f.dest[2], e));
      out.walk = e < 1;
      const c = f.grp === 0 ? [2.4, -3.7] : f.grp === 1 ? [out.p.x, 3.0] : [SPOT.moiwa[0] + 3, SPOT.moiwa[2] + 4];
      out.h = f.grp === 1 ? Math.PI + (f.r - 0.5) * 0.6 : Math.atan2(c[0] - out.p.x, c[1] - out.p.z);
      if (f.grp === 2) out.h = Math.atan2(1, 1);
    }
  }
  return out;
}

function plane() {
  const g = new THREE.Group();
  const white = mat(0xf2f4f8), blue = mat(0x2a4f8f);
  const body = mesh(new THREE.CapsuleGeometry(0.16, 1.3, 6, 12), white); body.rotation.x = Math.PI / 2; g.add(body);
  g.add(mesh(rbox(1.9, 0.05, 0.42, 0.02), white, 0, -0.03, 0.05));
  g.add(mesh(rbox(0.7, 0.04, 0.22, 0.02), white, 0, 0.05, -0.68));
  g.add(mesh(rbox(0.04, 0.42, 0.3, 0.02), blue, 0, 0.26, -0.68));
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), blue, s * 0.5, -0.12, 0.12)).children;
  g.children.slice(-2).forEach(e => (e.rotation.x = Math.PI / 2));
  const wl = glow(0xff5040, 0.35, 1); wl.position.set(-0.95, 0, 0.05); g.add(wl);
  const wr = glow(0x50ff90, 0.35, 1); wr.position.set(0.95, 0, 0.05); g.add(wr);
  const nose = glow(0xffffff, 0.6, 0.8); nose.position.set(0, -0.05, 0.85); g.add(nose);
  g.scale.setScalar(1.15);
  return g;
}

function planeState(k, t, p) {
  const d = k * 0.55, stop = PLANE_STOP[k], x = -5.7;
  let s = 1, pitch = 0;
  if (t < 4) {
    const a = prog(t, 0 + d, 0.75 + d), r = ease.out(prog(t, 0.75 + d, 1.5 + d));
    if (a < 1) { p.set(x, lerp(5.0, 0.24, ease.smooth(a) * 0.3 + a * 0.7), lerp(-6.6, -3.0, a)); pitch = -0.12 + a * 0.2; }
    else p.set(x, 0.24, lerp(-3.0, stop, r));
    s = Math.min(1, prog(t, d - 0.1, d + 0.25));
  } else {
    const t0 = 6.35 + k * 0.3;
    const a = ease.in(prog(t, t0, t0 + 1.0));
    p.set(x + a * 2.5, 0.24 + Math.max(0, a - 0.25) * 10, stop + a * 10);
    pitch = -Math.min(0.45, Math.max(0, a - 0.2) * 0.9);
    const dist = Math.hypot(p.x, p.y - 3, p.z);
    s = 1 - prog(dist, 7.6, 9.2);
  }
  return { s, pitch };
}

export function createCrowd(interior, town) {
  const g = new THREE.Group(); interior.add(g);
  const geo = {
    body: new THREE.CapsuleGeometry(0.085, 0.16, 4, 10).translate(0, 0.17, 0),
    head: new THREE.SphereGeometry(0.085, 12, 10).translate(0, 0.39, 0),
    tag: new THREE.BoxGeometry(0.06, 0.075, 0.02).translate(0, 0.2, 0.085),
    bag: rbox(0.13, 0.15, 0.07, 0.02).translate(0.15, 0.09, -0.02),
  };
  const im = {
    body: new THREE.InstancedMesh(geo.body, mat(0xffffff), N),
    head: new THREE.InstancedMesh(geo.head, mat(0xf0c8a8), N),
    tag: new THREE.InstancedMesh(geo.tag, new THREE.MeshBasicMaterial({ color: 0xffd27a }), N),
    bag: new THREE.InstancedMesh(geo.bag, mat(0x5b6c8f), N),
  };
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    im.body.setColorAt(i, col.set(F[i].coat));
    im.bag.setColorAt(i, col.set([0x5b6c8f, 0xb94a3c, 0x2f3a52, 0xd0a040][i % 4]));
  }
  for (const k in im) { im[k].castShadow = true; im[k].frustumCulled = false; g.add(im[k]); }

  const planes = [plane(), plane()];
  planes.forEach(p => g.add(p));
  const st = { p: new THREE.Vector3() };

  return {
    update(t) {
      const tf = town.stage.factor(t);
      for (let i = 0; i < N; i++) {
        state(i, t, st);
        const f = F[i];
        const bob = st.walk ? Math.abs(Math.sin(t * 16 + f.ph)) * 0.04 : Math.sin(t * 3 + f.ph) * 0.008;
        const s = st.s * tf;
        tmp.set(st.p.x, st.p.y + bob, st.p.z);
        q.setFromEuler(eu.set(0, st.h, st.walk ? Math.sin(t * 16 + f.ph) * 0.08 : 0));
        mtx.compose(tmp, q, sc.setScalar(Math.max(s, 1e-4)));
        im.body.setMatrixAt(i, mtx); im.head.setMatrixAt(i, mtx); im.tag.setMatrixAt(i, mtx);
        mtx.compose(tmp, q, sc.setScalar(Math.max(s * st.luggage, 1e-4)));
        im.bag.setMatrixAt(i, mtx);
      }
      for (const k in im) im[k].instanceMatrix.needsUpdate = true;
      planes.forEach((pl, k) => {
        const { s, pitch } = planeState(k, t, pl.position);
        const on = t < 8 ? s * tf : 0;
        pl.visible = on > 0.001;
        pl.scale.setScalar(1.15 * Math.max(on, 1e-4));
        pl.rotation.set(pitch, 0, 0);
      });
    },
  };
}
