// Beats 3 and 4: a schedule with gaps, gaps become onsen / ramen / night view, places light up, coins flow.
import * as THREE from 'three';
import { C, mat, mesh, rbox, glow, rng, clamp, prog, ease, lerp, pop } from './lib.js';
import { SPOT } from './town.js';

const T = { panelIn: 7.55, gapsOpen: 8.25, fly: 8.75, panelOut: 11.0 };
const LAND = [9.45, 9.65, 9.85];                 // onsen, ramen, night view
const TARGETS = [
  [2.4, 0.6, -3.7], [-0.75, 0.9, 4.4], [-3.6, 3.4, -5.1],
];
export const litAt = t => ({
  onsen: ease.out(prog(t, LAND[0], LAND[0] + 0.5)),
  ramen: ease.out(prog(t, LAND[1], LAND[1] + 0.5)),
  moiwa: ease.out(prog(t, LAND[2], LAND[2] + 0.5)),
  shops: ease.out(prog(t, 10.0, 10.8)),
});

function onsenIcon() {
  const g = new THREE.Group();
  const tub = mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.26, 20), mat(0x8a5a3a), 0, 0, 0); g.add(tub);
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 20), new THREE.MeshBasicMaterial({ color: 0xffb070 }), 0, 0.12, 0));
  for (let k = -1; k <= 1; k++) {
    const pts = []; for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(k * 0.2 + Math.sin(i / 12 * Math.PI * 2) * 0.06, 0.18 + i / 12 * 0.55, 0));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.04, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  }
  return g;
}
function ramenIcon() {
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * 0.48 + 0.01, -Math.cos(a) * 0.36)); }
  const bowl = mesh(new THREE.LatheGeometry(prof, 24), mat(0xc8352b, { side: THREE.DoubleSide }), 0, 0.2, 0); g.add(bowl);
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.02, 24), new THREE.MeshBasicMaterial({ color: 0xf0b860 }), 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), mat(0xfdf6ee), 0.15, 0.19, 0.1));
  g.add(mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(0xffc840), -0.13, 0.19, 0.08));
  for (const s of [-1, 1]) { const c = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.9), mat(0x3a2418), s * 0.05 + 0.1, 0.4, -0.05); c.rotation.set(0.5, 0.3, 0); g.add(c); }
  return g;
}
function viewIcon() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(0.45, 0.6, 7), mat(0x2d4b5a, { flatShading: true }), 0, 0, 0));
  g.add(mesh(new THREE.ConeGeometry(0.2, 0.25, 7), mat(C.snow, { flatShading: true }), 0, 0.18, 0));
  g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), 0.32, 0.5, 0));
  for (const [x, y] of [[-0.35, 0.55], [-0.05, 0.7], [0.5, 0.25]]) { const s = glow(0xfff2c0, 0.25); s.position.set(x, y, 0.05); g.add(s); }
  g.position.y = -0.05;
  const w = new THREE.Group(); w.add(g); return w;
}

export function createFreetime(interior, town) {
  const root = new THREE.Group(); interior.add(root);

  // Schedule panel: seven slots, three of them free.
  const panel = new THREE.Group(); panel.position.set(0, 6.6, 2.4); panel.rotation.x = -0.3; panel.userData.k = 1.3; root.add(panel);
  const kinds = ['s', 'g', 's', 'g', 's', 's', 'g'];
  const gapIdx = [1, 3, 6];
  const W = 1.22, gap = 0.12;
  const back = mesh(rbox(7 * W + 8 * gap, 1.05, 0.12, 0.08), mat(0x1c2a4a), 0, 0, -0.1, false); panel.add(back);
  const tiles = [], gapFill = [];
  kinds.forEach((k, i) => {
    const x = (i - 3) * (W + gap);
    const g = new THREE.Group(); g.position.x = x; panel.add(g);
    if (k === 's') {
      g.add(mesh(rbox(W, 0.8, 0.14, 0.06), mat(0x4a6aa8), 0, 0, 0, false));
      g.add(mesh(new THREE.BoxGeometry(W * 0.6, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0xc8d8ff }), -0.1, 0.12, 0.08, false));
      g.add(mesh(new THREE.BoxGeometry(W * 0.4, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0x8aa4d8 }), -0.2, -0.06, 0.08, false));
    } else {
      const fm = new THREE.MeshBasicMaterial({ color: C.amber });
      for (const [w, h, px, py] of [[W, 0.05, 0, 0.38], [W, 0.05, 0, -0.38], [0.05, 0.8, W / 2 - 0.025, 0], [0.05, 0.8, -W / 2 + 0.025, 0]])
        g.add(mesh(new THREE.BoxGeometry(w, h, 0.05), fm, px, py, 0, false));
      const fill = mesh(rbox(W, 0.8, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xe8902a, transparent: true, opacity: 0 }), 0, 0, 0, false);
      g.add(fill); gapFill.push(fill);
      const gl = glow(C.amber, 2.2, 0); g.add(gl); fill.userData.glow = gl;
    }
    tiles.push(g);
  });

  const icons = [onsenIcon(), ramenIcon(), viewIcon()];
  icons.forEach(ic => root.add(ic));
  const badges = icons.map((ic, j) => { const b = ic.clone(); b.position.set(0, -0.1, 0.25); tiles[gapIdx[j]].add(b); return b; });
  const flashes = TARGETS.map(() => { const f = glow(0xffe0a0, 1, 0); root.add(f); return f; });

  // Coins: fly from attendees at each place into shops and stalls.
  const NC = 200, coinGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.055, 18);
  const coinMat = mat(0xffc540, { emissive: 0xa86a00 });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, NC); coins.frustumCulled = false; root.add(coins);
  const sources = [[2.4, 0.3, -3.7], [-0.9, 0.4, 5.0], [-3.2, 2.6, -4.7]];
  const dests = [[-2.5, 0.6, 1.6], [-1.38, 0.6, 1.6], [-0.26, 0.6, 1.6], [0.86, 0.6, 1.6], [1.98, 0.6, 1.6], [3.5, 0.7, -5.0], [-1.5, 0.7, 4.2], [0.0, 0.7, 4.3]];
  const r = rng(77);
  const C0 = Array.from({ length: NC }, (_, k) => {
    const s = sources[k % 3];
    return {
      a: new THREE.Vector3(s[0] + (r() - 0.5) * 0.8, s[1], s[2] + (r() - 0.5) * 0.8),
      b: new THREE.Vector3(...dests[Math.floor(r() * dests.length)]),
      t0: 11.5 + (k / NC) * 3.0 + r() * 0.1, dur: 0.8 + r() * 0.3, h: 2.0 + r() * 1.6, spin: r() * 6,
    };
  });
  // Coin stacks in front of the shops grow with the money.
  const SN = 5, SH = 12;
  const stacks = new THREE.InstancedMesh(coinGeo, coinMat, SN * SH); stacks.frustumCulled = false; root.add(stacks);

  const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  return {
    update(t) {
      const tf = town.stage.factor(t);
      // Panel
      const pin = ease.out(prog(t, T.panelIn, T.panelIn + 0.7));
      panel.position.y = lerp(11.5, 6.6, pin);
      const pf = pop(t, T.panelIn, T.panelOut, 0, 0.5);
      panel.visible = pf > 0.002 && t < 12;
      panel.scale.setScalar(1.3 * Math.max(1e-4, Math.min(1, pin * 1.2) * (1 - ease.in(prog(t, T.panelOut, T.panelOut + 0.45)))));
      tiles.forEach((g, i) => g.scale.setScalar(Math.max(1e-4, pop(t, T.panelIn + 0.1 + i * 0.05, null, 0, 0.4))));
      gapFill.forEach((f, j) => {
        const open = prog(t, T.gapsOpen + j * 0.1, T.gapsOpen + j * 0.1 + 0.3);
        const filled = prog(t, LAND[j] - 0.1, LAND[j] + 0.3);
        f.material.opacity = Math.max(open * (0.25 + 0.2 * Math.sin(t * 10)), filled);
        f.userData.glow.material.opacity = open * (1 - filled) * 0.9 + filled * 0.4;
        const bs = ease.back(prog(t, LAND[j] + 0.05, LAND[j] + 0.45)) * 0.62;
        badges[j].visible = bs > 0.002; badges[j].scale.setScalar(Math.max(1e-4, bs));
        badges[j].rotation.set(0.2, Math.sin(t * 2 + j) * 0.3, 0);
      });
      // Icons: pop out of their gap, then arc down to the place
      icons.forEach((ic, j) => {
        const t0 = T.gapsOpen + 0.1 + j * 0.12, tf0 = T.fly + j * 0.18, land = LAND[j];
        panel.updateMatrixWorld();
        const from = tiles[gapIdx[j]].getWorldPosition(new THREE.Vector3());
        root.worldToLocal(from); from.z += 0.5;
        const to = new THREE.Vector3(...TARGETS[j]);
        const u = ease.inOut(prog(t, tf0, land));
        v.lerpVectors(from, to, u); v.y += Math.sin(u * Math.PI) * 1.2;
        ic.position.copy(v);
        const sIn = pop(t, t0, null, 0, 0.4), sOut = 1 - ease.in(prog(t, land - 0.12, land));
        const s = sIn * sOut * (1.3 - 0.5 * u);
        ic.visible = s > 0.002;
        ic.scale.setScalar(Math.max(1e-4, s));
        ic.rotation.set(0.25, Math.sin(t * 2 + j) * 0.4 + u * Math.PI * 2, 0);
        const fl = prog(t, land - 0.05, land + 0.45);
        flashes[j].position.copy(to);
        flashes[j].scale.setScalar(1 + ease.out(fl) * 4.5);
        flashes[j].material.opacity = fl > 0 && fl < 1 ? (1 - fl) * 0.9 : 0;
      });
      // Coins
      let n = 0;
      for (const c of C0) {
        const u = (t - c.t0) / c.dur;
        if (u < 0 || u > 1 || tf < 0.01) continue;
        v.lerpVectors(c.a, c.b, u); v.y += Math.sin(u * Math.PI) * c.h;
        q.setFromEuler(e.set(1.2 + t * 7 + c.spin, t * 3 + c.spin, 0));
        const s = Math.min(1, u * 6, (1 - u) * 8) * tf;
        coins.setMatrixAt(n++, m4.compose(v, q, s3.setScalar(Math.max(s, 1e-4))));
      }
      coins.count = n; coins.instanceMatrix.needsUpdate = true;
      const money = ease.inOut(prog(t, 11.8, 14.4));
      let k = 0;
      for (let i = 0; i < SN; i++) {
        const h = Math.floor(lerp(0, SH, clamp(money * 1.1 - i * 0.03)) + 1e-6);
        for (let j = 0; j < h; j++) {
          v.set(dests[i][0] + Math.sin(j * 2.1 + i) * 0.015, 0.02 + j * 0.04, 1.95);
          stacks.setMatrixAt(k++, m4.compose(v, q.identity(), s3.setScalar(Math.max(tf, 1e-4))));
        }
      }
      stacks.count = t > 11.5 ? k : 0; stacks.instanceMatrix.needsUpdate = true;

      const L = litAt(t), boost = 1 + 0.5 * money;
      for (const key in L) town.lit[key] = L[key] * (key === 'shops' ? boost : 1);
    },
  };
}
