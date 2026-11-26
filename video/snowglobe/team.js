// Beats 5 and 6: an org chart of 17 busy workers; 15 turn into AI agents orbiting 2 relaxed people.
import * as THREE from 'three';
import { C, mat, mesh, rbox, glow, rng, clamp, prog, ease, lerp, pop, Stage } from './lib.js';
import { worker, busy, agentBot } from './figures.js';

const IN = 15.0, CHANGE = 18.65, OUT = 21.75;
const KEEP = [0, 2];
const BENCH = new THREE.Vector3(0, 0, 0.9);

function slots() {
  const s = [[0, 2.0, -2.6]];
  for (let i = 0; i < 4; i++) s.push([-3.6 + i * 2.4, 1.0, -0.5]);
  for (let i = 0; i < 12; i++) s.push([-6.05 + i * 1.1, 0, 2.0]);
  return s.map(p => new THREE.Vector3(...p));
}

export function createTeam(interior) {
  const root = new THREE.Group(); interior.add(root);
  const stage = new Stage([[IN, CHANGE + 0.55]]);
  const add = (o, d) => { root.add(o); return stage.add(o, d); };
  const S = slots(), rand = rng(9);

  // Tiers, desks, chart lines
  add(mesh(rbox(1.5, 2.0, 1.3, 0.1), mat(0x34466e), 0, 1.0, -2.6), 0);
  add(mesh(rbox(9.4, 1.0, 1.3, 0.1), mat(0x2c3c60), 0, 0.5, -0.5), 0.05);
  const lineMat = new THREE.MeshBasicMaterial({ color: C.amber });
  const link = (a, b) => {
    const A = a.clone().add(new THREE.Vector3(0, 0.35, 0.25)), B = b.clone().add(new THREE.Vector3(0, 1.15, 0));
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, A.distanceTo(B), 6), lineMat);
    l.position.copy(A).add(B).multiplyScalar(0.5);
    l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    add(l, 0.15);
  };
  for (let i = 1; i <= 4; i++) link(S[0], S[i]);
  for (let i = 5; i < 17; i++) link(S[1 + Math.floor((i - 5) / 3)], S[i]);
  for (let i = 5; i < 17; i++) {
    const d = new THREE.Group(); d.position.set(S[i].x, 0, S[i].z + 0.42);
    d.add(mesh(rbox(0.8, 0.36, 0.42, 0.04), mat(0x8a6a50), 0, 0.18, 0));
    const h = 1 + Math.floor(rand() * 6);
    for (let k = 0; k < h; k++) d.add(mesh(new THREE.BoxGeometry(0.26, 0.05, 0.3), mat(0xfbfbf6), -0.2 + (k % 2) * 0.02, 0.385 + k * 0.05, 0));
    add(d, 0.1 + i * 0.01);
  }
  const bench = new THREE.Group(); bench.position.copy(BENCH);
  bench.add(mesh(rbox(1.4, 0.1, 0.5, 0.04), mat(0x9a6a44), 0, 0.32, 0));
  bench.add(mesh(rbox(1.4, 0.4, 0.08, 0.04), mat(0x9a6a44), 0, 0.6, -0.24));
  for (const s of [-0.6, 0.6]) bench.add(mesh(new THREE.BoxGeometry(0.06, 0.3, 0.4), mat(0x2a2f3d), s, 0.15, 0));
  root.add(bench);

  const workers = S.map((p, i) => { const w = worker(i); w.position.copy(p); root.add(w); return w; });
  const order = workers.map((_, i) => i).filter(i => !KEEP.includes(i)).sort(() => rand() - 0.5);
  const rank = new Map(order.map((i, r) => [i, r]));
  const agents = order.map(() => { const a = agentBot(); root.add(a); return a; });
  const flashes = order.map(() => { const f = glow(0xbff8ff, 1, 0); root.add(f); return f; });
  const rings = [[2.7, 2.3, 6], [3.9, 1.2, 9]].map(([r, y]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 6, 96),
      new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = Math.PI / 2; m.position.set(BENCH.x, y, BENCH.z); root.add(m); return m;
  });

  // Flying papers above the bottom row
  const NP = 30, papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), NP);
  papers.frustumCulled = false; root.add(papers);
  const P = Array.from({ length: NP }, () => ({ i: 5 + Math.floor(rand() * 12), ph: rand(), dx: (rand() - 0.5) * 1.6, sp: 0.5 + rand() * 0.4 }));

  const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const orbit = (r, t) => {
    const ring = r < 6 ? 0 : 1, k = ring ? r - 6 : r, n = ring ? 9 : 6, [rad, y] = ring ? [3.9, 1.2] : [2.7, 2.3];
    const a = (k / n) * Math.PI * 2 + t * (ring ? -0.55 : 0.75);
    return v.set(BENCH.x + Math.cos(a) * rad, y + Math.sin(t * 2.5 + r) * 0.12, BENCH.z + Math.sin(a) * rad * 0.85);
  };

  return {
    update(t) {
      const live = t > IN - 0.1 && t < OUT + 1;
      root.visible = live;
      if (!live) return;
      stage.update(t);
      const outAll = 1 - ease.in(prog(t, OUT, OUT + 0.4));
      workers.forEach((w, i) => {
        const ph = i * 1.7;
        const sIn = pop(t, IN + 0.05 + (i === 0 ? 0 : i < 5 ? 0.12 : 0.22) + (i % 5) * 0.03, null, 0, 0.45);
        const p = w.userData.p;
        if (KEEP.includes(i)) {
          const k = KEEP.indexOf(i), seat = new THREE.Vector3(BENCH.x + (k ? 0.36 : -0.36), 0.0, BENCH.z + 0.02);
          const u = ease.inOut(prog(t, CHANGE + 0.35 + k * 0.1, CHANGE + 1.15 + k * 0.1));
          w.position.lerpVectors(S[i], seat, u); w.position.y += Math.sin(u * Math.PI) * 1.2;
          w.scale.setScalar(1.2 * Math.max(1e-4, sIn * outAll));
          w.visible = sIn * outAll > 0.002;
          if (u < 0.5) busy(w, t, ph);
          else {
            const tt = t * 1.4 + k;
            p.body.rotation.set(-0.22, Math.sin(tt) * 0.05, 0); p.body.position.y = 0.32;
            p.head.rotation.set(-0.1, 0, Math.sin(tt) * 0.08 + (k ? -0.1 : 0.1));
            p.arms[0].rotation.set(0.5, 0, -2.5); p.arms[1].rotation.set(0.5, 0, 2.5);
            p.legs.forEach((l, j) => (l.rotation.x = -1.45 + Math.sin(tt * 1.3 + j) * 0.06));
          }
          const prop = 1 - prog(t, CHANGE + 0.3, CHANGE + 0.6);
          for (const o of [p.phone, p.papers, p.sweat, p.stress]) { o.visible = prop > 0.01; o.scale.setScalar(Math.max(1e-4, prop)); }
          if (u >= 0.5) p.sweat.visible = p.stress.visible = false;
          return;
        }
        const r = rank.get(i), tc = CHANGE + r * 0.055;
        const sOut = 1 - ease.in(prog(t, tc, tc + 0.18));
        const s = sIn * sOut;
        w.visible = s > 0.002; w.scale.setScalar(1.2 * Math.max(1e-4, s));
        busy(w, t, ph);
        // flash + agent
        const fl = prog(t, tc + 0.05, tc + 0.45), f = flashes[r];
        f.position.copy(S[i]).add(new THREE.Vector3(0, 0.75, 0));
        f.scale.setScalar(0.6 + ease.out(fl) * 2.6); f.material.opacity = fl > 0 && fl < 1 ? (1 - fl) : 0;
        const a = agents[r], sa = pop(t, tc + 0.1, null, 0, 0.35) * outAll;
        a.visible = sa > 0.002; a.scale.setScalar(Math.max(1e-4, sa));
        const fly = ease.inOut(prog(t, CHANGE + 0.95 + r * 0.03, CHANGE + 1.85 + r * 0.03));
        const start = S[i].clone().add(new THREE.Vector3(0, 0.8, 0));
        a.position.lerpVectors(start, orbit(r, t), fly);
        a.position.y += Math.sin(fly * Math.PI) * 0.8;
        const toC = Math.atan2(BENCH.x - a.position.x + 0, 6 - a.position.z);
        a.rotation.set(0, toC * 0.6, 0);
        a.userData.inner.position.y = Math.sin(t * 4 + r) * 0.05;
        a.userData.inner.rotation.z = Math.sin(t * 3 + r) * 0.12;
      });
      bench.visible = t > CHANGE + 0.2;
      bench.scale.setScalar(Math.max(1e-4, pop(t, CHANGE + 0.3, OUT, 0, 0.45)));
      rings.forEach((m, k) => (m.material.opacity = 0.5 * prog(t, CHANGE + 1.6, CHANGE + 2.2) * outAll));
      // papers
      const pv = clamp(prog(t, IN + 0.4, IN + 0.8) - prog(t, CHANGE, CHANGE + 0.4));
      for (let k = 0; k < NP; k++) {
        const c = P[k], u = (t * c.sp + c.ph) % 1, base = S[c.i];
        v.set(base.x + c.dx * u, 0.5 + Math.sin(u * Math.PI) * 2.0, base.z + 0.4 + u * 0.8);
        q.setFromEuler(e.set(t * 5 + k, t * 3 + k * 2, Math.sin(t * 6 + k)));
        papers.setMatrixAt(k, m4.compose(v, q, s3.setScalar(Math.max(1e-4, pv * Math.min(1, Math.sin(u * Math.PI) * 3)))));
      }
      papers.instanceMatrix.needsUpdate = true;
    },
  };
}
