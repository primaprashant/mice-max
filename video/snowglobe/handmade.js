// Beat 7: one worker builds one program by hand, brick by brick, while the clock spins and the coins drain.
import * as THREE from 'three';
import { C, mat, mesh, rbox, glow, rng, clamp, prog, ease, lerp, pop, Stage } from './lib.js';
import { worker } from './figures.js';

const IN = 22.1, OUT = 25.15;
const NB = 11, DONE0 = 2;
const DROPS = [22.7, 23.4, 24.1, 24.8];

export function createHandmade(interior) {
  const root = new THREE.Group(); interior.add(root);
  const stage = new Stage([[IN, OUT]]);
  const add = (o, d) => { root.add(o); return stage.add(o, d); };

  // One conference hall, one onsen
  const hall = new THREE.Group(); hall.position.set(-3.5, 0, -0.7);
  hall.add(mesh(rbox(2.4, 0.9, 1.6), mat(0xc9d1de), 0, 0.45, 0));
  const vault = mesh(new THREE.CylinderGeometry(0.82, 0.82, 2.5, 24, 1, false, 0, Math.PI), mat(C.snow), 0, 0.9, 0);
  vault.rotation.set(0, 0, Math.PI / 2); vault.scale.set(0.45, 1, 0.98); hall.add(vault);
  hall.add(mesh(new THREE.PlaneGeometry(2.1, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd08a }), 0, 0.45, 0.805, false));
  add(hall, 0);
  const ons = new THREE.Group(); ons.position.set(3.7, 0, -0.9); ons.rotation.y = -0.2;
  ons.add(mesh(rbox(1.8, 0.75, 1.2), mat(0x6a4535), 0, 0.375, 0));
  const hip = mesh(new THREE.ConeGeometry(1.5, 0.6, 4), mat(C.snow), 0, 1.05, 0); hip.rotation.y = Math.PI / 4; hip.scale.z = 0.7; ons.add(hip);
  ons.add(mesh(new THREE.PlaneGeometry(1.3, 0.28), mat(0x141a2c), 0, 0.42, 0.605, false));
  add(ons, 0.05);

  // Path slots from hall to onsen
  const slot = i => { const u = i / (NB - 1); return new THREE.Vector3(lerp(-2.2, 2.6, u), 0.06, 0.9 + Math.sin(u * Math.PI) * 0.7); };
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const brickMat = mat(0xc77a4a);
  const bricks = [];
  for (let i = 0; i < NB; i++) {
    const p = slot(i);
    const gh = mesh(new THREE.BoxGeometry(0.46, 0.015, 0.34), ghostMat, p.x, 0.01, p.z, false); add(gh, 0.1 + i * 0.015);
    const b = mesh(rbox(0.46, 0.12, 0.34, 0.03), brickMat, p.x, p.y, p.z); root.add(b); bricks.push(b);
  }

  // Worker with a hard hat and a hammer
  const w = worker(3, { hat: true }); root.add(w);
  const p = w.userData.p;
  p.phone.visible = false; p.papers.visible = false; p.stress.visible = false;
  const hammer = new THREE.Group();
  hammer.add(mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), mat(0x7a5a3a), 0, -0.15, 0));
  hammer.add(mesh(rbox(0.16, 0.08, 0.08, 0.02), mat(0x5a6070), 0, -0.3, 0));
  hammer.position.y = -0.24; p.arms[1].add(hammer);

  // Coin stack that drains with each brick
  const NC = 30, coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18);
  const coinMat = mat(C.gold, { emissive: 0x7a4a00 });
  const stack = new THREE.InstancedMesh(coinGeo, coinMat, NC); stack.frustumCulled = false; root.add(stack);
  const flying = new THREE.InstancedMesh(coinGeo, coinMat, 8); flying.frustumCulled = false; root.add(flying);
  const STACK = new THREE.Vector3(-2.7, 0, 1.9);

  // Big clock, hands spinning
  const clock = new THREE.Group(); clock.position.set(0.3, 1.45, -3.9); clock.scale.setScalar(0.7);
  clock.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 48), mat(0xfbf6ea), 0, 0, 0, false));
  clock.children[0].rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(1.52, 0.1, 10, 64), mat(C.gold, { emissive: 0x5a3a00 }), 0, 0, 0, false); clock.add(rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, tk = mesh(new THREE.BoxGeometry(0.06, i % 3 ? 0.14 : 0.26, 0.02), mat(0x2a2f3d), Math.sin(a) * 1.25, Math.cos(a) * 1.25, 0.09, false);
    tk.rotation.z = -a; clock.add(tk);
  }
  const hand = (len, th, c) => { const h = new THREE.Group(); h.add(mesh(new THREE.BoxGeometry(th, len, 0.03), mat(c), 0, len / 2 - 0.08, 0, false)); h.position.z = 0.12; clock.add(h); return h; };
  const hourH = hand(0.75, 0.09, 0x2a2f3d), minH = hand(1.15, 0.05, 0xd9473b);
  clock.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0x2a2f3d), 0, 0, 0.14, false));
  add(clock, 0.2);

  const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  return {
    update(t) {
      const live = t > IN - 0.1 && t < OUT + 1;
      root.visible = live;
      if (!live) return;
      stage.update(t);
      const f = stage.factor(t);
      // bricks
      let done = DONE0;
      bricks.forEach((b, i) => {
        let y = 0.06, s = f, sy = 1;
        if (i >= DONE0) {
          const td = DROPS[i - DONE0];
          if (td === undefined) s = 0;
          else {
            const u = prog(t, td - 0.35, td);
            if (u >= 1) done = i + 1;
            y = 0.06 + (1 - ease.in(u)) * 1.4;
            s = u > 0 ? f * Math.min(1, u * 4) : 0;
            const sq = prog(t, td, td + 0.2);
            if (sq > 0 && sq < 1) sy = 1 - Math.sin(sq * Math.PI) * 0.35;
          }
        }
        b.position.y = y; b.visible = s > 0.002;
        b.scale.set(Math.max(s, 1e-4), Math.max(s * sy, 1e-4), Math.max(s, 1e-4));
      });
      // worker: kneels beside the next slot, taps with hammer, shuffles forward after each brick
      const next = slot(Math.min(NB - 1, done));
      const prev = slot(Math.max(0, done - 1));
      let k = 0; for (const d of DROPS) if (t > d + 0.25) k++;
      const step = ease.inOut(prog(t, (DROPS[k - 1] ?? 0) + 0.25, (DROPS[k - 1] ?? 0) + 0.6));
      const target = slot(DONE0 + k), from = slot(DONE0 + Math.max(0, k - 1));
      w.position.lerpVectors(k ? from : target, target, k ? step : 1);
      w.position.z += 0.55; w.position.x += 0.1; w.position.y = 0;
      w.rotation.y = 1.05;
      w.scale.setScalar(1.45 * Math.max(1e-4, pop(t, IN + 0.15, OUT, 0, 0.45)));
      w.visible = t < OUT + 0.6;
      const tap = Math.max(0, Math.sin(t * 9));
      p.body.rotation.set(0.35, 0, 0); p.body.position.y = 0.24 - Math.abs(Math.sin(t * 9)) * 0.02;
      p.arms[1].rotation.set(-1.2 - tap * 1.4, 0, 0.1);
      p.arms[0].rotation.set(-0.6, 0, -0.2);
      p.legs.forEach((l, j) => (l.rotation.x = -0.9 + j * 0.4));
      const sw = (t * 1.1) % 1; p.sweat.position.set(-0.21, 0.1 - sw * 0.35, 0.08); p.sweat.scale.setScalar(1 - sw);
      // coins drain
      const spent = clamp((t - IN) / (OUT - IN));
      const n = Math.round(lerp(NC, 9, ease.inOut(spent)));
      for (let i = 0; i < NC; i++) {
        v.set(STACK.x + Math.sin(i * 2.3) * 0.02, 0.03 + i * 0.065, STACK.z);
        stack.setMatrixAt(i, m4.compose(v, q.identity(), s3.setScalar(i < n ? Math.max(f, 1e-4) : 1e-4)));
      }
      stack.instanceMatrix.needsUpdate = true;
      let c = 0;
      for (let j = 0; j < 8; j++) {
        const u = ((t - IN) * 0.9 + j / 8) % 1, top = new THREE.Vector3(STACK.x, 0.1 + n * 0.065, STACK.z);
        v.lerpVectors(top, w.position, u); v.y += Math.sin(u * Math.PI) * 1.0;
        q.setFromEuler(e.set(t * 6 + j, t * 2, 0));
        flying.setMatrixAt(c++, m4.compose(v, q, s3.setScalar(Math.max(1e-4, f * Math.min(1, Math.sin(u * Math.PI) * 4) * 0.7))));
      }
      flying.instanceMatrix.needsUpdate = true;
      // clock
      minH.rotation.z = -(t - IN) * Math.PI * 2 * 1.4;
      hourH.rotation.z = -(t - IN) * Math.PI * 2 * 0.12 - 1;
      clock.rotation.z = Math.sin(t * 2) * 0.03;
    },
  };
}
