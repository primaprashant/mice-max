// Beats 3-4: a schedule with gaps floats over the convention center; the gaps become an onsen, ramen and a night view.
// Little groups walk to each place, the places light up, then coins flow from the visitors into the town.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mesh, mat, box, ball, cyl, ramenBowl, litMat, setLit, glow, setGlow } from '../lib/props.js';
import { SPOT, pathAt } from '../lib/town.js';
import { clamp, smooth, backOut, easeOut, ease, hash, lerp } from '../lib/util.js';

const T0 = 7.5;
// Gap cells [col, row] and what fills them.
const GAPS = [{ cell: [0, 3], kind: 'onsen', at: 8.15 }, { cell: [1, 1], kind: 'ramen', at: 8.55 }, { cell: [2, 3], kind: 'view', at: 8.95 }];
let card, icons = [], dots, steam, coins, dest = {}, halos = {}, trail;
const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();

export function schedCard(gapSet, w = 1.9, h = 1.3) {
  const g = new THREE.Group();
  const M = c => mat(c, { emissive: c, emissiveIntensity: 0.45 });
  g.add(mesh(new RoundedBoxGeometry(w, h, 0.07, 2, 0.05), M(0xffffff)));
  g.add(mesh(new RoundedBoxGeometry(w - 0.1, 0.16, 0.08, 2, 0.04), M(0x3b6fe0), 0, h / 2 - 0.13, 0.01));
  const cw = (w - 0.3) / 3, ch = (h - 0.42) / 4, cells = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) {
    const x = -w / 2 + 0.15 + cw * (c + 0.5), y = h / 2 - 0.3 - ch * (r + 0.5);
    const gap = gapSet.some(([gc, gr]) => gc === c && gr === r);
    if (gap) { // empty slot: a thin outline
      const bw = cw - 0.06, bh = ch - 0.05, o = M(0xc3cbd8);
      for (const [sx, sy, ox, oy] of [[bw, 0.012, 0, bh / 2], [bw, 0.012, 0, -bh / 2], [0.012, bh, bw / 2, 0], [0.012, bh, -bw / 2, 0]])
        g.add(mesh(new THREE.BoxGeometry(sx, sy, 0.02), o, x + ox, y + oy, 0.04));
    } else g.add(mesh(new RoundedBoxGeometry(cw - 0.06, ch - 0.05, 0.06, 2, 0.025), M([0x9db8f2, 0xb7c9f5, 0x8aa6ea][(c + r) % 3]), x, y, 0.045));
    cells.push({ c, r, x, y });
  }
  g.userData.cell = (c, r) => cells.find(e => e.c === c && e.r === r);
  return g;
}

function icon(kind) {
  const g = new THREE.Group();
  if (kind === 'ramen') { const b = ramenBowl(0.1); b.position.y = 0.04; b.rotation.x = 0.5; g.add(b); }
  if (kind === 'onsen') {
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.05, 14), 0x6fc7d1, 0, -0.04, 0));
    for (const x of [-0.05, 0, 0.05]) { const p = ball(0.025, 0xffffff, x, 0.04 + Math.abs(x) * -0.4, 0, 8); p.scale.y = 1.8; g.add(p); }
  }
  if (kind === 'view') {
    g.add(mesh(new THREE.ConeGeometry(0.11, 0.15, 5), mat(0x6c5fb5, { flatShading: true }), 0, -0.02, 0));
    g.add(ball(0.035, mat(0xfff1b8, { emissive: 0xffe28a, emissiveIntensity: 0.8 }), 0.08, 0.08, 0, 8));
  }
  g.rotation.x = -0.25; return g;
}

export function build({ scene, town }) {
  card = schedCard(GAPS.map(g => g.cell)); scene.add(card);
  card.position.set(SPOT.conv[0] + 0.1, 1.55, SPOT.conv[1] + 0.2);
  for (const gp of GAPS) { const ic = icon(gp.kind); card.add(ic); const c = card.userData.cell(...gp.cell); ic.position.set(c.x, c.y, 0.1); icons.push(ic); }
  dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }), 3 * 26);
  steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 }), 14);
  const cg = new THREE.CylinderGeometry(0.06, 0.06, 0.016, 12); cg.rotateX(Math.PI / 2);
  coins = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0xffa800, emissiveIntensity: 0.6 }), 90);
  [dots, steam, coins].forEach(o => { o.frustumCulled = false; scene.add(o); });
  coins.castShadow = true;
  town.group.updateMatrixWorld(true);
  const door = [SPOT.conv[0], SPOT.conv[1] + 0.5];
  const pool = town.ryokan.localToWorld(town.ryokan.userData.poolPos.clone());
  const ya = town.yatai.localToWorld(new THREE.Vector3(0, 0, 0.42));
  const top = new THREE.Vector3(SPOT.moiwa[0], 1.62, SPOT.moiwa[1] + 0.02);
  dest = {
    onsen: { at: pool, glow: new THREE.Vector3(pool.x - 0.4, 0.8, pool.z - 0.4), path: [door, [-1.4, 1.6], [-2.4, 1.75], [pool.x + 0.4, pool.z + 0.1]], n: 6 },
    ramen: { at: ya, glow: new THREE.Vector3(ya.x, 0.9, ya.z - 0.35), path: [door, [-1.0, 1.7], [ya.x + 0.25, ya.z + 0.2]], n: 3 },
    view: { at: top, glow: top.clone().setY(1.85), path: [door, [-1.6, 1.25], [-3.4, 1.0], [SPOT.moiwa[0] + 0.15, SPOT.moiwa[1] + 0.22]], n: 4 },
  };
  halos = { onsen: glow(0xffc27a, 1.6), ramen: glow(0xff7a4a, 1.3), view: glow(0xffd98a, 1.5) };
  halos.onsen.position.copy(pool).setY(0.35); halos.ramen.position.copy(ya).setY(0.45); halos.view.position.copy(top).setY(1.8);
  Object.values(halos).forEach(h => scene.add(h));
  // Lights running up the mountain path.
  trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), 16);
  trail.frustumCulled = false; scene.add(trail);
}

// Point on a raised arc from a to b.
const arc = (a, b, u, lift) => v.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * lift, lerp(a.z, b.z, u));

export function update(t, { crowd, town, camera }) {
  const on = t > 7.3 && t < 15.2;
  card.visible = on; dots.visible = steam.visible = coins.visible = on;
  // Places light up once their arc lands; everything else in town glows with the evening.
  const lit = { onsen: smooth(8.75, 9.1, t), ramen: smooth(9.15, 9.5, t), view: smooth(9.55, 9.9, t) };
  const fade = 1 - smooth(14.8, 15.6, t);
  setLit(town.ryokan.userData.win, lit.onsen * fade); setLit(town.ryokan.userData.pool, lit.onsen * 0.4 * fade);
  setLit(town.yatai.userData.lamp, lit.ramen * fade); setLit(town.moiwa.deck, lit.view * fade);
  for (const k in halos) setGlow(halos[k], lit[k] * fade * (0.85 + 0.15 * Math.sin(t * 5 + k.length)));
  for (let i = 0; i < 16; i++) {
    const u = i / 15, a = u * 5.2 + 0.4, r = 1.25 * (1 - u) + 0.12;
    const on = smooth(9.4 + u * 0.5, 9.5 + u * 0.5, t) * fade;
    m4.compose(v.set(SPOT.moiwa[0] + Math.cos(a) * r, 1.6 * (1 - r / 1.35) + 0.03, SPOT.moiwa[1] + Math.sin(a) * r), q, s3.setScalar(on)); trail.setMatrixAt(i, m4);
  }
  trail.instanceMatrix.needsUpdate = true;
  const evening = smooth(9.6, 10.4, t) * fade;
  town.shops.forEach((s, i) => setLit(s.userData.win, smooth(9.8 + i * 0.12, 10.1 + i * 0.12, t) * fade));
  setLit(town.houses.userData.win, evening * 0.8);
  setLit(town.conv.userData.glass, evening * 0.6);
  if (!on) return;

  // Card pops out of the roof, then tucks back in at the end of beat 3.
  const pop = backOut(clamp((t - 7.6) / 0.55)) * (1 - easeOut(clamp((t - 9.9) / 0.45)));
  card.scale.setScalar(Math.max(0.001, pop)); card.position.y = 0.5 + pop * 1.05;
  card.lookAt(camera.position.x, card.position.y + (camera.position.y - card.position.y) * 0.5, camera.position.z);
  card.updateMatrixWorld(true);
  GAPS.forEach((gp, i) => icons[i].scale.setScalar(Math.max(0.001, 1.5 * backOut(clamp((t - gp.at) / 0.4)))));

  // Dotted arcs from each icon to its place.
  let n = 0;
  GAPS.forEach((gp, i) => {
    const a = icons[i].getWorldPosition(new THREE.Vector3()), b = dest[gp.kind].glow;
    const head = clamp((t - gp.at - 0.2) / 0.6), tail = clamp((t - gp.at - 0.75) / 0.5);
    for (let j = 0; j < 26; j++) {
      const u = j / 25, vis = head > 0 && u <= head && u >= tail;
      arc(a, b, u, 0.8); m4.compose(v, q, s3.setScalar(vis ? (j % 2 ? 0.6 : 1) * (1 - 0.4 * u) : 0)); dots.setMatrixAt(n++, m4);
    }
  });
  dots.instanceMatrix.needsUpdate = true;

  // Groups walk from the door to each place, then settle (onsen: heads in the pool).
  let id = 300;
  for (const [kind, d] of Object.entries(dest)) {
    const start = { onsen: 9.0, ramen: 9.3, view: 9.5 }[kind];
    for (let j = 0; j < d.n; j++, id++) {
      const k = clamp((t - start - j * 0.14) / 1.7);
      if (k <= 0) continue;
      const settle = smooth(0.92, 1, k);
      let [x, z, h] = pathAt(d.path, ease(k)), y = 0, head = h, o = { walk: (t - start) * 4 + j, badge: true };
      if (kind === 'view') { const r = Math.hypot(x - SPOT.moiwa[0], z - SPOT.moiwa[1]); y = Math.max(0, 1.6 * (1 - r / 1.2)); }
      if (settle > 0) {
        const a = j / d.n * Math.PI * 2 + 0.6;
        const spot = kind === 'onsen' ? [d.at.x + Math.cos(a) * 0.15, d.at.y - 0.1, d.at.z + Math.sin(a) * 0.14]
          : kind === 'ramen' ? [d.at.x - 0.24 + j * 0.16, 0.03, d.at.z] : [d.at.x - 0.15 + j * 0.1, 1.62, d.at.z + 0.13];
        x = lerp(x, spot[0], settle); z = lerp(z, spot[2], settle); y = lerp(y, spot[1], settle);
        head = kind === 'onsen' ? lerp(h, -a + Math.PI * 1.5, settle) : kind === 'ramen' ? lerp(h, Math.PI + 0.2, settle) : lerp(h, 0.2, settle);
        if (settle >= 1) o = { badge: kind !== 'onsen', hop: kind === 'onsen' ? 0 : Math.abs(Math.sin(t * 5 + j)) * 0.01 };
      }
      crowd.add(x, y, z, head, id, o);
    }
  }

  // Steam over the onsen once it is lit.
  for (let i = 0; i < 14; i++) {
    const u = (t * 0.45 + i / 14) % 1, p = dest.onsen.at;
    const sc = Math.sin(u * Math.PI) * (0.5 + u) * lit.onsen;
    m4.compose(v.set(p.x + Math.sin(i * 2.3 + t) * 0.12, p.y + 0.05 + u * 0.7, p.z + Math.cos(i * 1.7) * 0.12), q, s3.setScalar(sc)); steam.setMatrixAt(i, m4);
  }
  steam.instanceMatrix.needsUpdate = true;

  // Coins: hop from each group into its place (beat 4), and out of the road shops.
  const money = smooth(11.4, 11.9, t) * (1 - smooth(14.7, 15.1, t));
  const srcs = [...Object.values(dest).map(d => [d.path[d.path.length - 1], d.glow, d.at.y]),
    ...town.shops.map(sh => [[sh.position.x + 0.3, sh.position.z + 0.35], sh.position.clone().setY(0.45), 0])];
  n = 0;
  srcs.forEach(([from, to, y0], si) => {
    for (let c = 0; c < 10; c++) {
      const u = (t * 0.8 + c / 10 + hash(si) ) % 1, a = new THREE.Vector3(from[0] + (hash(c + si * 10) - 0.5) * 0.3, y0 + 0.12, from[1] + (hash(c * 3 + si) - 0.5) * 0.3);
      arc(a, to, u, 0.5);
      q.setFromAxisAngle(s3.set(0, 1, 0), t * 6 + c);
      m4.compose(v, q, s3.setScalar(money * Math.min(1, Math.sin(u * Math.PI) * 3))); coins.setMatrixAt(n++, m4);
    }
  });
  q.identity();
  coins.count = n; coins.instanceMatrix.needsUpdate = true;
}

// Header roll for beat 4: "¥170M" counts up from 33.
export function rollHeader(b, words, local) {
  if (b.id !== 'money') return;
  const w = [...words].find(e => e.textContent.includes('M') && e !== words[0]) || words[2];
  const val = Math.round(lerp(33, 170, ease(clamp((local - 0.35) / 1.6))));
  const txt = `¥${val}M`; if (w.textContent !== txt) w.textContent = txt;
}
