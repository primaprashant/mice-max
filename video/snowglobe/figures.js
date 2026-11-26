// Chibi office worker and AI agent bot, built from simple shapes.
import * as THREE from 'three';
import { mat, mesh, rbox, glow, canvasTexture } from './lib.js';

const SKIN = [0xf2cba8, 0xdba882, 0xf6d8bd, 0xc58f68];
const HAIR = [0x231a16, 0x3b2a20, 0x4a4a52, 0x1a1a24];
const SUIT = [0x2c3e66, 0x3a3f4f, 0x24304a, 0x51465e, 0x2f4a4a];

let stressTex;
function stressMark() {
  stressTex ??= canvasTexture(128, 128, (g) => {
    g.strokeStyle = '#ff4a3a'; g.lineWidth = 13; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 2 + Math.PI / 4);
      g.beginPath(); g.moveTo(-14, -44); g.quadraticCurveTo(-14, -14, -44, -14); g.stroke(); g.restore();
    }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stressTex, transparent: true, depthWrite: false }));
  s.scale.setScalar(0.32);
  return s;
}

// A worker: returns a group with named parts for animation.
export function worker(i, { hat = false } = {}) {
  const g = new THREE.Group();
  const p = {};
  const suit = mat(SUIT[i % SUIT.length]), skin = mat(SKIN[i % SKIN.length]);
  p.body = new THREE.Group(); p.body.position.y = 0.32; g.add(p.body);
  p.body.add(mesh(new THREE.CapsuleGeometry(0.17, 0.2, 4, 12), suit, 0, 0.12, 0));
  p.body.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), mat(0xf6f6f6), 0, 0.2, 0.165));
  p.body.add(mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), mat(0xd9473b), 0, 0.17, 0.18));
  p.head = new THREE.Group(); p.head.position.y = 0.55; p.body.add(p.head);
  p.head.add(mesh(new THREE.SphereGeometry(0.21, 18, 14), skin));
  const hair = mesh(new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hat ? mat(0xf2c230) : mat(HAIR[i % HAIR.length]), 0, 0.02, -0.01);
  hair.rotation.x = -0.25; p.head.add(hair);
  for (const s of [-1, 1]) p.head.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0x1a1a22), s * 0.075, 0.01, 0.195, false));
  p.legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.08, 0.32, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.06, 0.16, 3, 8), mat(0x1f2433), 0, -0.16, 0));
    g.add(leg); p.legs.push(leg);
  }
  p.arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.2, 0.27, 0); p.body.add(arm);
    arm.add(mesh(new THREE.CapsuleGeometry(0.05, 0.16, 3, 8), suit, 0, -0.12, 0));
    p.arms.push(arm);
  }
  // Props: phone in right hand, papers in left
  p.phone = mesh(rbox(0.05, 0.14, 0.09, 0.015), mat(0x15151c), 0, -0.24, 0.02);
  p.arms[1].add(p.phone);
  p.papers = new THREE.Group(); p.papers.position.set(0, -0.24, 0.1);
  for (let k = 0; k < 4; k++) p.papers.add(mesh(new THREE.BoxGeometry(0.2, 0.015, 0.26), mat(0xfbfbf6), (k % 2) * 0.02, k * 0.02, 0, false));
  p.arms[0].add(p.papers);
  p.stress = stressMark(); p.stress.position.set(0.2, 0.32, 0); p.head.add(p.stress);
  p.sweat = mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fdcff }), -0.2, 0.08, 0.1, false);
  p.sweat.scale.y = 1.5; p.head.add(p.sweat);
  g.userData.p = p;
  return g;
}

// Pose a worker as busy and stressed at time t.
export function busy(w, t, ph) {
  const p = w.userData.p;
  p.body.rotation.y = Math.sin(t * 7 + ph) * 0.35;
  p.body.position.y = 0.32 + Math.abs(Math.sin(t * 11 + ph)) * 0.035;
  p.head.rotation.z = Math.sin(t * 13 + ph) * 0.12;
  p.arms[1].rotation.set(-0.3, 0, 2.85 + Math.sin(t * 9 + ph) * 0.08);
  p.arms[0].rotation.set(-1.1 + Math.sin(t * 8 + ph) * 0.15, 0, -0.2);
  p.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 11 + ph + k * Math.PI) * 0.25; });
  const s = (t * 1.3 + ph) % 1;
  p.sweat.position.set(-0.21, 0.1 - s * 0.35, 0.08);
  p.sweat.scale.setScalar(1 - s);
  p.stress.scale.setScalar(0.3 + Math.abs(Math.sin(t * 6 + ph)) * 0.08);
}

// A small AI agent bot with glowing eyes and an antenna.
export function agentBot() {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  inner.add(mesh(rbox(0.56, 0.46, 0.46, 0.16), mat(0xeef3ff, { emissive: 0x1a3550 }), 0, 0, 0));
  inner.add(mesh(rbox(0.44, 0.22, 0.06, 0.08), mat(0x0e1a2e), 0, 0.01, 0.22, false));
  const eye = new THREE.MeshBasicMaterial({ color: 0x6ff7e6 });
  for (const s of [-1, 1]) inner.add(mesh(rbox(0.07, 0.1, 0.03, 0.03), eye, s * 0.1, 0.01, 0.255, false));
  inner.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), mat(0x9aa6c0), 0, 0.3, 0));
  inner.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc35a }), 0, 0.39, 0, false));
  const gl = glow(0x5fe0d0, 1.6, 0.45); inner.add(gl);
  g.userData.inner = inner;
  return g;
}
