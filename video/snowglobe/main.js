// Snow globe intro: scene setup, camera path, globe shakes, headers and the page contract.
import * as THREE from 'three';
import { C, clamp, prog, ease, lerp } from './lib.js';
import { createGlobe, R, CY } from './globe.js';
import { createTown } from './town.js';
import { createCrowd } from './crowd.js';
import { createFreetime } from './freetime.js';
import { createTeam } from './team.js';
import { createHandmade } from './handmade.js';
import { createScale, proj, T8 } from './scale.js';
import { createLogo, T9 } from './logo.js';
import { renderHeaders, buildHeaders } from './headers.js';

const W = 1920, H = 1080;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 1000);

scene.add(new THREE.HemisphereLight(0x5a78c8, 0x10152b, 0.75));
const moon = new THREE.DirectionalLight(0xb0c6ff, 1.1);
moon.position.set(-9, 16, 10);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
moon.shadow.bias = -0.0015;
scene.add(moon);
const warm = new THREE.PointLight(0xffb060, 0, 9, 1.6);
warm.position.set(0.5, 2.2, 3.0);
scene.add(warm);
const rim = new THREE.DirectionalLight(0x8fb0ff, 1.0);
rim.position.set(6, 5, -12);
scene.add(rim);

const globe = createGlobe(scene);
const town = createTown(globe.interior, [[-10, 14.65], [25.45, null]]);
const crowd = createCrowd(globe.interior, town);
const free = createFreetime(globe.interior, town);
const team = createTeam(globe.interior);
const hand = createHandmade(globe.interior);
let scale, logo;

// Globe shakes: each one swirls the snow and hides a change of scene inside.
const SHAKES = [[14.5, 15.5], [21.55, 22.45], [25.1, 25.9]];
function shake(t) {
  let swirl = 0, lift = 0, rot = 0, x = 0;
  for (const [a, b] of SHAKES) {
    const p = prog(t, a, b);
    swirl += ease.inOut(p) * 6;
    const env = Math.sin(p * Math.PI);
    lift += env * env;
    const e2 = p > 0 && p < 1 ? Math.sin(p * Math.PI * 7) * Math.pow(1 - p, 1.5) : 0;
    rot += e2 * 0.1; x += e2 * 0.8;
  }
  return { swirl, lift, rot, x };
}

// Camera keys: time, target, distance, elevation and azimuth (degrees). Interpolated smoothly (monotone cubic).
const [hx, hz] = proj(142.6, 43.2), [jx, jz] = proj(137.2, 37.6);
const KEYS = [
  [0.0, [0, 4.0, 0], 50, 9, -22],
  [2.0, [0, 2.9, 0.4], 22.5, 21, -7],
  [4.0, [0, 2.6, 0.6], 20.5, 24, 0],
  [6.6, [-0.8, 2.6, 0.6], 20, 23, 7],
  [7.6, [0, 3.6, 0.6], 21, 17, 3],
  [9.2, [0, 3.4, 0], 21.5, 21, 0],
  [11.5, [0, 2.6, 0], 20.5, 28, -5],
  [14.3, [0, 2.6, 0], 20, 30, 5],
  [15.0, [0, 3.4, 0], 27, 18, 2],
  [15.7, [0, 2.2, 0], 16, 13, 0],
  [18.6, [0, 2.1, 0.2], 15.2, 14, 3],
  [20.2, [0, 1.6, 0.9], 12.5, 15, 0],
  [21.4, [0, 1.6, 0.9], 11.5, 16, -4],
  [22.0, [0, 3.0, 0], 24, 18, 0],
  [22.7, [0, 1.6, 0.3], 13.5, 19, 0],
  [25.1, [0, 1.6, 0.3], 12.5, 21, 4],
  [25.6, [0, 3, 0], 30, 20, 0],
  [26.6, [0, -2, -14], 150, 27, 0],
  [27.55, [hx * 0.8, 0, hz * 0.8 + 60], 1750, 64, 0],
  [28.45, [jx, 0, jz + 350], 5400, 70, 0],
  [30.0, [jx, 0, jz + 350], 5900, 72, 0],
];
const KV = KEYS.map(([t, tg, d, el, az]) => [t, [...tg, Math.log(d), el, az]]);
function camAt(t) {
  let i = 0;
  while (i < KV.length - 2 && KV[i + 1][0] <= t) i++;
  const [t0, a] = KV[i], [t1, b] = KV[i + 1];
  const u = clamp((t - t0) / (t1 - t0)), h = t1 - t0;
  const slope = (j, k) => {
    if (j <= 0 || j >= KV.length - 1) return 0;
    const d0 = (KV[j][1][k] - KV[j - 1][1][k]) / (KV[j][0] - KV[j - 1][0]);
    const d1 = (KV[j + 1][1][k] - KV[j][1][k]) / (KV[j + 1][0] - KV[j][0]);
    return d0 * d1 <= 0 ? 0 : 2 / (1 / d0 + 1 / d1);
  };
  const u2 = u * u, u3 = u2 * u;
  return a.map((p0, k) => (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * slope(i, k) + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * h * slope(i + 1, k));
}

function placeCamera(t) {
  const [tx, ty, tz, ld, el, az] = camAt(t);
  const d = Math.exp(ld), e = el * Math.PI / 180, a = az * Math.PI / 180;
  camera.position.set(tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(a) * Math.cos(e));
  camera.lookAt(tx, ty, tz);
  camera.near = Math.max(0.1, d * 0.02); camera.far = d * 6 + 200;
  camera.updateProjectionMatrix();
  return d;
}

function renderAt(t) {
  const d = placeCamera(t);
  const sh = shake(t);
  globe.rig.rotation.z = sh.rot; globe.rig.position.x = sh.x;

  const px = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(camera.fov * Math.PI / 360));
  const su = globe.snow.material.uniforms;
  Object.assign(su.uTime, { value: t }); su.uSwirl.value = sh.swirl; su.uLift.value = sh.lift; su.uScale.value = px;
  const ou = globe.outerSnow.material.uniforms;
  ou.uTime.value = t; ou.uScale.value = px;
  ou.uOpacity.value = 0.55 * (1 - prog(t, 1.5, 2.5)) + 0.2 * prog(t, 2.5, 3) * (1 - prog(t, 25.6, 26.6));

  free.update(t);
  town.update(t);
  crowd.update(t);
  team.update(t);
  hand.update(t);
  scale.update(t, d);
  warm.intensity = 6 * Math.max(town.lit.shops * 0.6, town.lit.ramen * 0.6) * town.stage.factor(t) + (t > 15 && t < 25.3 ? 3 : 0);

  renderer.clear();
  renderer.render(scene, camera);
  const sap = new THREE.Vector3(0, CY - 3, 0).project(camera);
  const lu = logo.cam; logo.scene.traverse(o => o.material?.uniforms?.uScale && (o.material.uniforms.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(lu.fov * Math.PI / 360))));
  if (logo.update(t, sap)) { renderer.clearDepth(); renderer.render(logo.scene, logo.cam); }
  renderHeaders(t);
}

window.ready = (async () => {
  scale = await createScale(scene);
  logo = await createLogo();
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  scale.setResolution(sz.x, sz.y);
  await buildHeaders(document.getElementById('headers'));
  renderAt(0);
})();
window.renderAt = renderAt;

if (!location.search.includes('render')) {
  window.ready.then(() => {
    const t0 = performance.now();
    const loop = () => { renderAt(((performance.now() - t0) / 1000) % 30); requestAnimationFrame(loop); };
    loop();
  });
}
