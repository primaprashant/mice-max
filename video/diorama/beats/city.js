// Beat 7: the city pays a pile of coins, and one worker slowly builds one program by hand, block by block.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mesh, mat, box } from '../lib/props.js';
import { schedCard } from './freetime.js';
import { SPOT } from '../lib/town.js';
import { clamp, smooth, backOut, ease, hash, lerp } from '../lib/util.js';

const ALL = []; for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) ALL.push([c, r]);
const ORDER = [[0, 0], [1, 0], [2, 0]]; // the few cells the worker manages to fill
const PILE = new THREE.Vector3(1.85, 0, 0.05);
const BOARD = new THREE.Vector3(0.72, 0, 0.0);
const TRIP = 1.5, START = 22.5;
let board, blocks = [], carried, pile, sweat;
const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();

export function build({ scene }) {
  board = new THREE.Group(); board.position.copy(BOARD); scene.add(board);
  const card = schedCard(ALL); card.scale.setScalar(0.42); card.position.set(0, 0.45, 0.04); board.add(card);
  for (const x of [-0.2, 0.2]) { const leg = box(0.025, 0.42, 0.025, 0x8a6248, x, 0, -0.03); leg.rotation.z = x * 0.3; board.add(leg); }
  ORDER.forEach(([c, r]) => {
    const cell = card.userData.cell(c, r);
    const b = mesh(new RoundedBoxGeometry(0.5, 0.17, 0.06, 2, 0.025), mat(0x9db8f2, { emissive: 0x9db8f2, emissiveIntensity: 0.4 }), cell.x, cell.y, 0.05);
    card.add(b); blocks.push(b);
  });
  board.userData.card = card;
  carried = mesh(new RoundedBoxGeometry(0.16, 0.06, 0.06, 2, 0.02), mat(0x9db8f2, { emissive: 0x9db8f2, emissiveIntensity: 0.3 }));
  scene.add(carried);
  const cg = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12);
  pile = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0xffa800, emissiveIntensity: 0.35 }), 60);
  pile.castShadow = true; pile.frustumCulled = false; scene.add(pile);
  sweat = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), mat(0x8fd0ff, { emissive: 0x4fa8ff, emissiveIntensity: 0.4 }), 3);
  sweat.frustumCulled = false; scene.add(sweat);
}

export function update(t, { crowd }) {
  const on = t > 21.8 && t < 26.6;
  board.visible = carried.visible = pile.visible = sweat.visible = on;
  if (!on) return;
  const appear = backOut(clamp((t - 22.2) / 0.5)) * (1 - ease(clamp((t - 25.6) / 0.4)));
  board.scale.setScalar(Math.max(0.001, appear));

  // Coins pour out of the city hall door into a pile.
  for (let i = 0; i < 60; i++) {
    const land = 22.25 + i * 0.012, k = clamp((t - land + 0.35) / 0.35);
    const ring = Math.floor(Math.sqrt(i)), a = i * 2.4, r = 0.03 * ring;
    const tx = PILE.x + 0.12 + Math.cos(a) * r, tz = PILE.z - 0.18 + Math.sin(a) * r * 0.7, ty = 0.01 + (7 - ring) * 0.016;
    const sx = SPOT.hall[0] + 0.3, sz = SPOT.hall[1] + 0.3;
    v.set(lerp(sx, tx, k), lerp(0.2, ty, k) + Math.sin(k * Math.PI) * 0.35, lerp(sz, tz, k));
    q.setFromAxisAngle(s3.set(1, 0, 0), (1 - k) * 6);
    m4.compose(v, q, s3.setScalar(k > 0 ? 1 : 0)); pile.setMatrixAt(i, m4);
  }
  pile.instanceMatrix.needsUpdate = true;

  // The worker: slow trips from the pile to the board, one block each time.
  const u = Math.max(0, t - START), trip = Math.floor(u / TRIP), f = (u % TRIP) / TRIP;
  const go = f < 0.45, k = go ? ease(f / 0.45) : f < 0.55 ? 1 : 1 - ease((f - 0.55) / 0.45);
  const x = lerp(PILE.x, BOARD.x + 0.4, k), z = lerp(PILE.z, BOARD.z + 0.12, k);
  const heading = Math.atan2(BOARD.x + 0.4 - PILE.x, BOARD.z + 0.12 - PILE.z) + (go ? 0 : Math.PI);
  const moving = f < 0.45 || f > 0.55;
  crowd.add(x, 0, z, heading, 4, { walk: moving ? t * 2.2 : undefined, badge: false, lean: go ? 0.18 : 0.08, scale: 1.6 });
  const hasBlock = go && t > START && trip < ORDER.length;
  carried.visible = hasBlock;
  carried.position.set(x, 0.29 + Math.abs(Math.sin(t * 2.2 * Math.PI)) * 0.01, z); carried.rotation.y = heading;
  blocks.forEach((b, i) => { const placed = START + i * TRIP + TRIP * 0.5; b.scale.setScalar(Math.max(0.001, backOut(clamp((t - placed) / 0.25)))); });
  for (let i = 0; i < 3; i++) {
    const w = (t * 1.3 + i / 3) % 1;
    m4.compose(v.set(x + Math.sin(i * 2) * 0.07, 0.25 + w * 0.06 - w * w * 0.12, z + Math.cos(i * 2) * 0.06), q.identity(), s3.setScalar(Math.sin(w * Math.PI)));
    sweat.setMatrixAt(i, m4);
  }
  sweat.instanceMatrix.needsUpdate = true;
}
