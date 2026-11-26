// Beats 1-2: planes land, the crowd streams into the convention center, then walks straight back and flies home.
import * as THREE from 'three';
import { plane, box } from '../lib/props.js';
import { ROAD, SPOT, pathAt } from '../lib/town.js';
import { hash, smooth, ease, clamp, lerp } from '../lib/util.js';

const N = 120, LEN = 5.3, V_IN = 0.42, V_OUT = 0.62, TURN = 4.15;
let A, B;

export function build({ scene }) {
  A = plane(); B = plane(); scene.add(A, B);
  B.position.set(SPOT.parked[0], 0.12, SPOT.parked[1]); B.rotation.y = -Math.PI / 2;
  const stairs = box(0.08, 0.1, 0.22, 0xdfe3ea, SPOT.parked[0] + 0.12, 0, SPOT.parked[1] + 0.17); stairs.rotation.x = -0.35;
  scene.add(stairs);
}

// Landing plane: comes in from the east, touches down, rolls west, turns, then takes off east.
function poseA(t) {
  const y0 = 0.12, rz = SPOT.runway[1];
  if (t < 2.8) {
    const k = clamp(t / 2.8), x = lerp(5.7, 3.2, 1 - Math.pow(1 - k, 1.8));
    const air = Math.pow(1 - smooth(0, 1.0, t), 1.5);
    A.position.set(x, y0 + air * 0.3, rz); A.rotation.set(0, -Math.PI / 2, 0); A.children[0].rotation.x = -air * 0.12;
  } else if (t < 5.2) {
    const k = ease(clamp((t - 3.2) / 1.8));
    A.position.set(3.2 - Math.sin(k * Math.PI) * 0.25, y0, rz + 0.0); A.rotation.set(0, -Math.PI / 2 + k * Math.PI, 0);
    A.children[0].rotation.x = 0;
  } else {
    const u = t - 5.2, x = 3.2 + u * u * 1.2, lift = Math.max(0, x - 4.8);
    A.position.set(x, y0 + lift * lift * 0.1 + lift * 0.2, rz); A.rotation.set(0, Math.PI / 2, 0);
    A.children[0].rotation.x = -Math.min(0.32, lift * 0.25);
  }
}

// Distance walked along the road (in road fractions) for person i at time t.
function walked(i, t) {
  const turn = smooth(TURN - 0.15, TURN + 0.35, t);
  const fwd = Math.min(t, TURN) * V_IN + (t > TURN ? (t - TURN) * V_IN * (1 - turn) * 0.5 : 0);
  const back = t > TURN ? (t - TURN - 0.25) * V_OUT * turn : 0;
  return (fwd - Math.max(0, back)) / LEN;
}

export function update(t, { crowd, town }) {
  const live = t < 8.6;
  A.visible = B.visible = live;
  if (!live) return;
  poseA(t);
  const turn = smooth(TURN - 0.1, TURN + 0.4, t);
  for (let i = 0; i < N; i++) {
    let k = (hash(i) * 0.25 + i / N + walked(i, t)) % 1; if (k < 0) k += 1;
    const [x, z, h] = pathAt(ROAD, k);
    const side = (hash(i + 50) - 0.5) * 0.26 * smooth(0, 0.05, k) * (1 - smooth(0.9, 0.97, k));
    const appear = smooth(0, 0.025, k) * (1 - smooth(0.955, 0.985, k));
    if (appear <= 0.01) continue;
    const head = h + Math.PI * turn + (hash(i + 9) - 0.5) * 0.3;
    crowd.add(x + Math.cos(h) * side, 0, z - Math.sin(h) * side, head, i,
      { walk: t * 3.2 + hash(i) * 2, suitcase: hash(i + 3) > 0.3, scale: appear });
  }
  // Shops stay shut while the crowd passes (freetime.js opens them).
  for (const s of town.shops) s.userData.shutter.visible = t < 8.4;
}
