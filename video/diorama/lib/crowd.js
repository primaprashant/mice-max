// Tiny rounded people drawn as instanced meshes. Rebuilt every frame: begin(), add(...), end().
import * as THREE from 'three';

const CLOTHES = ['#3b5b92', '#e2725b', '#2f8f83', '#f2b544', '#7d5ba6', '#4a4f5c', '#d9576d', '#5aa0d8'].map(c => new THREE.Color(c));
const HAIR = ['#2b2320', '#4a3426', '#1d1d24', '#7a5a3a', '#b9b2a8'].map(c => new THREE.Color(c));
const STRAP = ['#ff5a5f', '#2f7df6', '#16a34a'].map(c => new THREE.Color(c));

export function makeCrowd(max = 400) {
  const part = (geo, color, n = max) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), n);
    m.castShadow = true; m.frustumCulled = false; m.count = 0; return m;
  };
  const bodyG = new THREE.CapsuleGeometry(0.03, 0.05, 3, 10); bodyG.translate(0, 0.055, 0);
  const headG = new THREE.SphereGeometry(0.027, 12, 9); headG.translate(0, 0.118, 0);
  const hairG = new THREE.SphereGeometry(0.029, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); hairG.translate(0, 0.121, -0.004);
  const badgeG = new THREE.BoxGeometry(0.018, 0.022, 0.006); badgeG.translate(0, 0.07, 0.03);
  const strapG = new THREE.TorusGeometry(0.022, 0.003, 4, 10, Math.PI); strapG.rotateZ(Math.PI); strapG.rotateX(-0.35); strapG.translate(0, 0.1, 0.012);
  const caseG = new THREE.BoxGeometry(0.036, 0.05, 0.022); caseG.translate(0.048, 0.03, -0.01);
  const handleG = new THREE.BoxGeometry(0.004, 0.03, 0.004); handleG.translate(0.048, 0.07, -0.01);
  const P = {
    body: part(bodyG, 0xffffff), head: part(headG, 0xf3c9a6), hair: part(hairG, 0xffffff),
    badge: part(badgeG, 0xffffff), strap: part(strapG, 0xffffff), suitcase: part(caseG, 0xffffff), handle: part(handleG, 0x555555),
  };
  const g = new THREE.Group(); Object.values(P).forEach(m => g.add(m));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const set = (m, i, col) => { m.setMatrixAt(i, m4); if (col) m.setColorAt(i, col); };
  let n = 0, ns = 0;
  return {
    group: g,
    begin() { n = 0; ns = 0; },
    // id: stable index for colours; o: { walk (phase), suitcase, badge, scale, lean, bob }
    add(x, y, z, heading, id, o = {}) {
      if (n >= max) return;
      const sc = o.scale ?? 1, walk = o.walk;
      const bob = walk === undefined ? 0 : Math.abs(Math.sin(walk * Math.PI)) * 0.012 * sc;
      const sway = walk === undefined ? 0 : Math.sin(walk * Math.PI) * 0.12;
      q.setFromEuler(e.set(o.lean ?? 0, heading, sway + (o.tilt ?? 0)));
      m4.compose(v.set(x, y + bob + (o.hop ?? 0), z), q, s.set(sc, sc * (o.squash ?? 1), sc));
      set(P.body, n, CLOTHES[id % CLOTHES.length]); set(P.head, n); set(P.hair, n, HAIR[(id * 7) % HAIR.length]);
      if (o.badge !== false) { set(P.badge, n, STRAP[id % 3].clone().lerp(new THREE.Color(1, 1, 1), 0.85)); set(P.strap, n, STRAP[id % 3]); }
      else { m4.makeScale(0, 0, 0); set(P.badge, n); set(P.strap, n); }
      n++;
      if (o.suitcase && ns < max) {
        q.setFromEuler(e.set(0, heading, 0)); m4.compose(v.set(x, y, z), q, s.set(sc, sc, sc));
        set(P.suitcase, ns, CLOTHES[(id * 3 + 1) % CLOTHES.length]); set(P.handle, ns); ns++;
      }
    },
    end() {
      for (const k of ['body', 'head', 'hair', 'badge', 'strap']) { P[k].count = n; P[k].instanceMatrix.needsUpdate = true; if (P[k].instanceColor) P[k].instanceColor.needsUpdate = true; }
      for (const k of ['suitcase', 'handle']) { P[k].count = ns; P[k].instanceMatrix.needsUpdate = true; if (P[k].instanceColor) P[k].instanceColor.needsUpdate = true; }
    },
  };
}
