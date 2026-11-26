// Beats 5-6: a floating office platform. 17 stressed workers in an org chart, then 15 of them
// turn into AI agents that orbit the 2 relaxed people left at the center.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mesh, mat, box, ball, glow, setGlow } from '../lib/props.js';
import { clamp, smooth, backOut, ease, easeOut, hash, lerp } from '../lib/util.js';

export const PLAT = new THREE.Vector3(2.0, 9.0, -3.0);
const S = 3.5; // people scale on the platform
const KEEP = [6, 7]; // the two who stay human (middle of the manager row)
let tethers, sofaZ = 0.35, root, tiers = [], desks = [], agents = [], papers, drops, lines, sofa, halo, puffs, phones;
const seats = [];
const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3();

// Org chart: 1 lead, 4 managers, 12 staff, on stepped tiers.
seats.push([0, 0.9, -1.25]);
for (let i = 0; i < 4; i++) seats.push([(i - 1.5) * 1.45, 0.45, -0.4]);
for (let i = 0; i < 12; i++) seats.push([(i - 5.5) * 0.53, 0, 0.55]);
// Index order: 0 lead, 1-4 managers, 5-16 staff. Keep two managers.
KEEP.splice(0, 2, 2, 3);

function agentBot(color) {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.34, 0.28, 0.28, 2, 0.08), mat(color, { emissive: color, emissiveIntensity: 0.25 })));
  g.add(mesh(new RoundedBoxGeometry(0.26, 0.16, 0.02, 2, 0.03), 0x1c2340, 0, 0.0, 0.141));
  const eye = mat(0x7ff3ff, { emissive: 0x7ff3ff, emissiveIntensity: 1.2 });
  for (const x of [-0.055, 0.055]) g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), eye, x, 0.005, 0.15));
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 5), 0xc9d2e0, 0, 0.18, 0));
  g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), eye, 0, 0.24, 0));
  const h = glow(color, 0.9); h.position.z = -0.05; g.add(h); g.userData.halo = h;
  return g;
}

export function build({ scene }) {
  root = new THREE.Group(); root.position.copy(PLAT); scene.add(root);
  // Floating slab with a rocky underside.
  root.add(mesh(new RoundedBoxGeometry(7.0, 0.3, 3.8, 2, 0.12), 0xf3ece0, 0, -0.15, 0));
  root.add(mesh(new RoundedBoxGeometry(7.1, 0.12, 3.9, 2, 0.05), 0xa9d79b, 0, -0.3, 0));
  root.children.forEach(c => { c.castShadow = false; });
  const rock = mesh(new THREE.ConeGeometry(2.4, 2.4, 9, 2), mat(0x8c6a50, { flatShading: true }), 0, -1.6, 0);
  rock.rotation.x = Math.PI; rock.scale.set(1.45, 1, 0.8); root.add(rock); rock.castShadow = false;
  tiers.push(mesh(new RoundedBoxGeometry(6.6, 0.45, 1.05, 2, 0.06), 0xe4ddd0, 0, 0, -0.45));
  tiers.push(mesh(new RoundedBoxGeometry(1.6, 0.9, 0.8, 2, 0.06), 0xd9d1c3, 0, 0, -1.3));
  tiers.forEach(o => { o.position.y = o.geometry.parameters.height / 2; root.add(o); });
  sofaZ = 0.35;
  // Org lines (blue bars on the floor and steps).
  const L = mat(0x3b6fe0, { emissive: 0x3b6fe0, emissiveIntensity: 0.4 });
  lines = new THREE.Group(); root.add(lines);
  lines.add(box(3.94, 0.02, 0.04, L, 0, 0.57, -0.62)); lines.add(box(0.04, 0.02, 0.45, L, 0, 0.57, -0.83));
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 1.3;
    lines.add(box(0.04, 0.02, 0.38, L, x, 0.29, -0.55 + 0.19));
    lines.add(box(1.04, 0.02, 0.04, L, x, 0.01, 0.38)); lines.add(box(0.04, 0.02, 0.3, L, x, 0.01, 0.2));
  }
  for (let i = 0; i < 12; i++) lines.add(box(0.03, 0.02, 0.2, L, (i - 5.5) * 0.5, 0.01, 0.48));
  // Desks with a paper pile and a phone.
  seats.forEach(([x, y, z], i) => {
    const d = new THREE.Group(); d.position.set(x, y, z - 0.24);
    d.add(box(0.4, 0.16, 0.2, 0xb88a64)); d.add(box(0.16, 0.06 + hash(i) * 0.08, 0.12, 0xffffff, -0.08, 0.16, 0));
    d.add(box(0.1, 0.03, 0.07, 0x2b3550, 0.11, 0.16, 0)); root.add(d); desks.push(d);
  });
  const colors = [0x8fb4ff, 0xb9a3ff, 0x7fe0c9, 0xffb3c7, 0xffd08a];
  seats.forEach((_, i) => { const a = agentBot(colors[i % 5]); a.visible = false; root.add(a); agents.push(a); });
  papers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.004, 0.16), mat(0xffffff), 34);
  drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0x8fd0ff, { emissive: 0x4fa8ff, emissiveIntensity: 0.4 }), 17);
  [papers, drops].forEach(o => { o.frustumCulled = false; root.add(o); });
  sofa = new THREE.Group();
  sofa.add(mesh(new RoundedBoxGeometry(1.2, 0.2, 0.45, 2, 0.08), 0xff8a7a, 0, 0.1, 0));
  sofa.add(mesh(new RoundedBoxGeometry(1.2, 0.36, 0.14, 2, 0.06), 0xff8a7a, 0, 0.18, -0.2));
  sofa.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 14), 0xf7f2ea, 0, 0.08, 0.5));
  sofa.add(mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.06, 8), 0xffffff, 0.06, 0.19, 0.5));
  sofa.position.set(0, 0, 0.3); root.add(sofa);
  halo = glow(0x9fd8ff, 3.2); halo.position.set(0, 0.6, 0.1); root.add(halo);
  puffs = seats.map(() => { const p = glow(0xffffff, 1.1); root.add(p); return p; });
  tethers = Array.from({ length: 15 }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 1), new THREE.MeshBasicMaterial({ color: 0xa9dcff, transparent: true, opacity: 0.7 })); root.add(m); return m; });
  phones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.08, 0.02), mat(0x1c2340), 17); phones.frustumCulled = false; root.add(phones);
}

export function update(t, ctx) {
  const { crowd } = ctx;
  const on = t > 14.4 && t < 23.0;
  if (t > 15 && t < 22) { ctx.focus = 0.4; ctx.band = 0.17; }
  root.visible = on; if (!on) return;
  // Platform rises into place, then sinks away when the camera leaves.
  root.position.y = PLAT.y - (1 - ease(clamp((t - 14.2) / 1.2))) * 2 + Math.pow(clamp((t - 21.45) / 0.8), 2) * 9;
  root.updateMatrixWorld();
  const busy = 1 - smooth(18.6, 19.0, t);
  const flat = ease(clamp((t - 19.2) / 0.9));
  tiers.forEach(o => { o.visible = flat < 0.99; o.scale.y = Math.max(0.01, 1 - flat); o.position.y = o.geometry.parameters.height / 2 * (1 - flat); });
  lines.visible = flat < 0.05; lines.scale.y = 1;
  const orbit = ease(clamp((t - 19.7) / 1.1));
  sofa.scale.setScalar(Math.max(0.001, backOut(clamp((t - 19.5) / 0.5))));
  setGlow(halo, orbit * 0.5);

  let pn = 0, dn = 0;
  seats.forEach(([x, y0, z], i) => {
    const y = y0 * (1 - flat), keep = KEEP.includes(i);
    const morph = keep ? 0 : clamp((t - 18.75 - (x + 3.2) / 6.4 * 0.5 - hash(i + 4) * 0.1) / 0.3);
    desks[i].scale.setScalar(Math.max(0.001, 1 - ease(clamp((t - 19.0 - hash(i) * 0.3) / 0.4))));
    desks[i].position.y = y;
    const jit = busy * Math.sin(t * 31 + i * 7) * 0.03;
    if (keep) {
      // Walk to the sofa and lean back.
      const k = ease(clamp((t - 19.2) / 0.9)), side = i === KEEP[0] ? -0.25 : 0.25;
      const px = lerp(x, side, k), pz = lerp(z, 0.32, k), sit = smooth(19.9, 20.2, t);
      crowd.add(root.position.x + px + jit, root.position.y + y * (1 - k) + sit * 0.12, root.position.z + pz + sit * 0.02,
        jit * 3 + (k > 0 && k < 1 ? Math.atan2(side - x, 0.32 - z) * (1 - sit) : 0), i * 3 + 1,
        { scale: S * (1 + sit * 0.25), badge: false, walk: k > 0 && k < 1 ? t * 4 : undefined, lean: -0.3 * sit, squash: 1 - sit * 0.2, hop: busy * Math.abs(Math.sin(t * 13 + i)) * 0.04 });
    } else if (morph < 1) {
      const sc = S * (1 - easeOut(morph));
      crowd.add(root.position.x + x + jit, root.position.y + y + morph * 0.3, root.position.z + z, jit * 4 + morph * 6, i * 3 + 1,
        { scale: Math.max(0.01, sc), badge: false, hop: busy * Math.abs(Math.sin(t * 13 + i)) * 0.05 });
    }
    setGlow(puffs[i], keep ? 0 : Math.sin(clamp(morph * 1.4) * Math.PI) * 0.9);
    puffs[i].position.set(x, y + 0.3, z + 0.1);
    q.setFromEuler(e.set(0, 0, 0.3));
    m4.compose(v.set(x + 0.09 + jit, y + 0.37, z + 0.02), q, s3.setScalar(i % 3 !== 1 && morph < 0.2 && busy > 0 ? 1 : 0)); phones.setMatrixAt(i, m4); q.identity();
    // Stress props: sweat drops and flying papers while busy.
    if (busy > 0 && morph < 0.5) {
      const u = (t * 1.6 + hash(i)) % 1;
      m4.compose(v.set(x - 0.1 - u * 0.1, y + 0.45 + u * 0.15 - u * u * 0.3, z + 0.05), q, s3.setScalar(Math.sin(u * Math.PI) * busy)); drops.setMatrixAt(dn++, m4);
      for (let p = 0; p < 2; p++) {
        const w = (t * 0.9 + hash(i * 2 + p)) % 1;
        q.setFromEuler(e.set(Math.sin(t * 9 + i) * 0.8, w * 6 + i, Math.cos(t * 7 + p) * 0.6));
        m4.compose(v.set(x + (p - 0.5) * 0.3 + Math.sin(w * 7) * 0.1, y + 0.2 + w * 0.8, z + 0.2), q, s3.setScalar(Math.sin(w * Math.PI) * busy * (morph < 0.01 ? 1 : 0)));
        papers.setMatrixAt(pn++, m4);
      }
      q.identity();
    }
    // Agent: pops in where the worker was, then joins the orbit around the sofa.
    const a = agents[i]; a.visible = !keep && morph > 0;
    if (a.visible) {
      const pop = backOut(clamp((morph - 0.4) / 0.6)), j = KEEP.length ? [...Array(17).keys()].filter(n => !KEEP.includes(n)).indexOf(i) : i;
      const ang = j / 15 * Math.PI * 2 + t * 0.35;
      const ox = Math.cos(ang) * 2.6, oz = Math.sin(ang) * 1.25 + 0.2, oy = 1.25 + Math.sin(ang * 2) * 0.12 + Math.sin(t * 3 + j) * 0.05;
      a.position.set(lerp(x, ox, orbit), lerp(y + 0.45, oy, orbit) + Math.sin(t * 4 + i) * 0.03, lerp(z, oz, orbit));
      a.rotation.set(0, Math.sin(t * 2 + i) * 0.3 * (1 - orbit), 0);
      a.scale.setScalar(Math.max(0.001, pop * 1.1));
      setGlow(a.userData.halo, 0.5 + 0.2 * Math.sin(t * 6 + i));
      // Tether from the agent to the sofa.
      const tl = tethers[j], from = a.position, to = v.set(0, 0.55, 0.3);
      tl.position.copy(from).add(to).multiplyScalar(0.5); tl.lookAt(root.localToWorld(to.clone()));
      tl.visible = false;
    }
  });
  for (let k = dn; k < 17; k++) { m4.makeScale(0, 0, 0); drops.setMatrixAt(k, m4); }
  for (let k = pn; k < 34; k++) { m4.makeScale(0, 0, 0); papers.setMatrixAt(k, m4); }
  drops.instanceMatrix.needsUpdate = papers.instanceMatrix.needsUpdate = phones.instanceMatrix.needsUpdate = true;
}
