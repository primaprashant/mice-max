// Entry: builds the world, then renderAt(t) poses everything for time t.
import * as THREE from 'three';
import { loadGeo, buildIsland, buildJapan } from './lib/geo.js';
import { paintTop, buildMountains, islandForest } from './lib/terrain.js';
import { buildTown } from './lib/town.js';
import { buildClouds } from './lib/clouds.js';
import { makeCrowd } from './lib/crowd.js';
import { makeSky, makePost } from './lib/post.js';
import { palette } from './lib/light.js';
import { placeCamera } from './lib/camera.js';
import { header } from './header.js';
import * as travel from './beats/travel.js';
import * as freetime from './beats/freetime.js';
import * as office from './beats/office.js';
import * as city from './beats/city.js';
import * as scale from './beats/scale.js';

const BEATS = [travel, freetime, office, city, scale];

async function init() {
  const tl = await fetch('../shared/timeline.json').then(r => r.json());
  await loadGeo();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(1920, 1080, false);
  renderer.shadowMap.enabled = true; renderer.localClippingEnabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1920 / 1080, 0.1, 100);
  const sky = makeSky(); scene.add(sky);
  scene.fog = new THREE.Fog(0xffffff, 10, 100);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;

  scene.add(buildIsland(paintTop()), buildMountains(), islandForest());
  const japan = buildJapan(); scene.add(japan);
  const town = buildTown(); scene.add(town.group);
  const clouds = buildClouds(); scene.add(clouds.mesh);
  const crowd = makeCrowd(420); scene.add(crowd.group);
  const ctx = { scene, town, crowd, japan, camera, renderer, headerExtra: freetime.rollHeader };
  for (const b of BEATS) b.build?.(ctx);
  const post = makePost(renderer);

  const Q = new URLSearchParams(location.search);
  if (Q.has('noshadow')) renderer.shadowMap.enabled = false;
  window.renderAt = t => {
    const p = palette(t);
    sky.material.uniforms.top.value.copy(p.top); sky.material.uniforms.bottom.value.copy(p.bottom); sky.material.uniforms.glow.value.copy(p.glow);
    hemi.color.copy(p.sky); hemi.groundColor.copy(p.ground); hemi.intensity = p.hemiI;
    sun.color.copy(p.sun); sun.intensity = p.sunI;
    const c = placeCamera(camera, t);
    scene.fog.color.copy(p.fog); scene.fog.near = c.d * 1.6; scene.fog.far = c.d * 7;
    // Shadow frustum follows the camera target.
    const s = Math.min(c.d * 0.9, 400);
    sun.target.position.set(c.x, 0, c.z);
    sun.position.set(c.x - s * 0.7, s * p.sunH, c.z + s * 0.8);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: s * 0.2, far: s * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    ctx.t = t; ctx.focus = ctx.band = undefined;
    clouds.update(t);
    crowd.begin();
    for (const b of BEATS) b.update(t, ctx);
    crowd.end();
    header(t, tl.beats, ctx.headerExtra);
    post.comp.focus.value = ctx.focus ?? 0.42; post.comp.band.value = ctx.band ?? 0.12;
    post.comp.amount.value = ctx.blur ?? 1;
    if (Q.has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); } else post.render(scene, camera);
  };
  window.renderAt(0);
}

window.ready = init();
if (!new URLSearchParams(location.search).has('render')) {
  window.ready.then(() => {
    const t0 = performance.now();
    const loop = () => { window.renderAt(((performance.now() - t0) / 1000) % 30); requestAnimationFrame(loop); };
    loop();
  });
}
