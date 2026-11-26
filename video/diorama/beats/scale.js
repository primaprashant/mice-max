// Beat 8-9: every venue in Sapporo gets a program at once, then the camera pulls out to Hokkaido and Japan
// while cities light up; ends on the logo.
import * as THREE from 'three';
import { schedCard } from './freetime.js';
import { glow, setGlow } from '../lib/props.js';
import { proj, geo } from '../lib/geo.js';
import { SPOT, VENUES } from '../lib/town.js';
import { clamp, smooth, backOut, ease, easeOut, hash } from '../lib/util.js';

const MORE = { Sendai: [140.87, 38.27], Nagoya: [136.91, 35.18], Hiroshima: [132.46, 34.39], Kanazawa: [136.65, 36.56], Niigata: [139.02, 37.92], Kagoshima: [130.56, 31.6], Kushiro: [144.38, 42.98] };
let cards = [], beacons = [];
const logo = document.getElementById('logo');

function beam() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true); g.translate(0, 0.5, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xffd27a) }, k: { value: 0 } },
    vertexShader: 'varying float vy; void main(){ vy = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vy; uniform vec3 color; uniform float k; void main(){ gl_FragColor = vec4(color, k * pow(1.0 - vy, 2.0) * 0.8); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}

const clip = new THREE.Plane(new THREE.Vector3(0.45, 0, -0.9).normalize(), 0);
export function build({ scene, japan, renderer }) {
  japan.material.forEach(m => { m.transparent = false; m.clippingPlanes = [clip]; });
  const spots = [SPOT.conv, ...VENUES];
  spots.forEach(([x, z], i) => {
    const c = schedCard([[i % 3, (i * 2) % 4], [(i + 1) % 3, (i + 3) % 4]]);
    c.position.set(x, 1.0 + (i % 3) * 0.15, z); c.userData.order = Math.hypot(x, z); scene.add(c); cards.push(c);
  });
  // Beacons: Sapporo first, then other Hokkaido cities, then Japan.
  const list = [['Sapporo', 26.25, 1], ['Otaru', 26.6, 1], ['Asahikawa', 26.75, 1], ['Hakodate', 26.9, 1], ['Obihiro', 27.0, 1], ['Kushiro', 27.1, 1],
    ['Sendai', 27.55, 2], ['Tokyo', 27.65, 2], ['Niigata', 27.75, 2], ['Nagoya', 27.8, 2], ['Kanazawa', 27.85, 2], ['Osaka', 27.9, 2], ['Hiroshima', 28.0, 2], ['Fukuoka', 28.05, 2], ['Kagoshima', 28.15, 2]];
  for (const [name, at, tier] of list) {
    const ll = geo.places[name] || MORE[name], [x, z] = proj(...ll);
    const b = { at, tier, beam: beam(), dot: glow(0xffd27a, 1), ring: new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })) };
    b.ring.rotation.x = -Math.PI / 2;
    for (const o of [b.beam, b.dot, b.ring]) { o.position.set(x, 0.05, z); scene.add(o); }
    beacons.push(b);
  }
}

export function update(t, ctx) {
  const { camera, japan } = ctx;
  // Cards pop over every venue in a ripple from the center.
  cards.forEach((c, i) => {
    const k = backOut(clamp((t - 25.55 - c.userData.order * 0.06) / 0.4)) * (1 - smooth(27.0, 27.4, t));
    c.visible = k > 0.001; c.scale.setScalar(Math.max(0.001, k * 0.42));
    if (c.visible) c.lookAt(camera.position.x, c.position.y + (camera.position.y - c.position.y) * 0.4, camera.position.z);
  });
  // Japan slides in under the pull-out.
  // Japan is revealed by a clipping plane sweeping south-west from Hokkaido.
  const jk = ease(clamp((t - 26.95) / 1.1));
  japan.visible = jk > 0.001;
  clip.constant = -40 + jk * 640;
  const d = camera.position.length();
  for (const b of beacons) {
    const k = easeOut(clamp((t - b.at) / 0.35));
    const vis = k > 0 && t < 30.5;
    [b.beam, b.dot, b.ring].forEach(o => { o.visible = vis; });
    if (!vis) continue;
    const s = Math.max(2, Math.hypot(camera.position.x - b.beam.position.x, camera.position.y, camera.position.z - b.beam.position.z)) * (b.tier === 1 ? 0.012 : 0.01);
    b.beam.scale.set(s * 0.3, s * 16 * k, s * 0.3); b.beam.material.uniforms.k.value = k * (0.8 + 0.2 * Math.sin(t * 7 + b.at * 10));
    b.dot.userData.size = s * 4; setGlow(b.dot, k);
    const pulse = ((t - b.at) * 1.2) % 1;
    b.ring.scale.setScalar(s * (0.6 + pulse * 2.2)); b.ring.material.opacity = (1 - pulse) * 0.7 * k;
  }
  // Logo.
  const lk = ease(clamp((t - 28.55) / 0.6));
  logo.style.opacity = lk;
  logo.style.transform = `translateY(${(1 - lk) * 30}px) scale(${0.94 + lk * 0.06})`;
}
