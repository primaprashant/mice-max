// The snow globe: glass, wooden base, snowy ground, table, falling snow.
import * as THREE from 'three';
import { C, mat, mesh, rng, canvasTexture } from './lib.js';

export const R = 10;          // glass radius
export const CY = 3;          // glass center height (ground is y = 0)
export const TABLE_Y = -3.6;

// Fake glass: fresnel rim plus a soft highlight and a reflected window, additive.
const glassVS = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const glassFS = `uniform vec3 uRim; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN); float back = gl_FrontFacing ? 1.0 : 0.35; if(!gl_FrontFacing) n = -n;
  float f = pow(1.0 - abs(dot(n, vV)), 2.6);
  vec3 c = uRim * f * 0.85;
  float h1 = pow(max(dot(n, normalize(vec3(-0.5, 0.62, 0.6))), 0.0), 90.0);
  vec2 w = n.xy;
  float win = smoothstep(0.40, 0.43, w.x) * (1.0 - smoothstep(0.60, 0.63, w.x)) * smoothstep(0.18, 0.21, w.y) * (1.0 - smoothstep(0.52, 0.55, w.y));
  float bar = 1.0 - (smoothstep(0.495, 0.505, w.x) - smoothstep(0.515, 0.525, w.x));
  c += vec3(1.0) * h1 * 1.2 + vec3(0.75, 0.85, 1.0) * win * bar * 0.10;
  gl_FragColor = vec4(c * back * uOpacity, 1.0);
}`;

export function makeGlass(r, cutY = -CY) {
  const theta = Math.acos(cutY / r);
  const m = new THREE.ShaderMaterial({
    vertexShader: glassVS, fragmentShader: glassFS, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uRim: { value: new THREE.Color(0x8fb8ff) }, uOpacity: { value: 1 } },
  });
  const g = new THREE.Mesh(new THREE.SphereGeometry(r, 72, 48, 0, Math.PI * 2, 0, theta), m);
  g.renderOrder = 10;
  return g;
}

export function makeBase(r, h = 3.6) {
  const k = r / 10, hk = h / 3.6;
  const pts = [[0, -3.6], [11.3, -3.6], [11.45, -3.35], [11.0, -3.05], [10.6, -1.1], [10.85, -0.8], [10.45, -0.35], [9.9, 0.12], [9.5, 0.12], [9.5, -0.6]]
    .map(([x, y]) => new THREE.Vector2(x * k, y * hk));
  const g = new THREE.Group();
  const base = mesh(new THREE.LatheGeometry(pts, 64), mat(0x3a2418), 0, 0, 0);
  const ring = mesh(new THREE.TorusGeometry(10.8 * k, 0.13 * k, 8, 64), mat(C.gold, { emissive: 0x6a4410 }), 0, -0.82 * hk, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(base, ring);
  return g;
}

// Snow as a pure function of time. Inside a sphere, or in a box around the scene.
const snowVS = `attribute vec4 seed; uniform float uTime, uSwirl, uLift, uR, uSize, uScale, uBox, uGround;
varying float vA;
void main(){
  vec3 p;
  if (uBox > 0.5) {
    float H = 70.0;
    p = vec3(seed.x * 90.0, 50.0 - mod(seed.z * H + uTime * (1.2 + seed.w * 1.6), H), seed.y * 60.0 - 10.0);
    p.x += sin(uTime * 0.6 + seed.z * 50.0) * 1.2;
    vA = 1.0;
  } else {
    float H = 2.0 * uR;
    float y = uR - mod(seed.z * H + uTime * uR * (0.035 + seed.w * 0.05), H);
    vec2 xz = seed.xy * uR + 0.03 * uR * vec2(sin(uTime * 0.7 + seed.z * 40.0), cos(uTime * 0.6 + seed.w * 30.0));
    float r = length(xz) / uR;
    float a = uSwirl * (1.8 - r) * (0.7 + seed.w * 0.6);
    xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * xz;
    y += uLift * uR * (0.25 + 1.1 * fract(seed.z * 7.3)) * (1.0 - r * 0.4);
    y = -0.3 * uR + mod(y + 0.3 * uR, 1.3 * uR);
    p = vec3(xz.x, y, xz.y);
    vA = (1.0 - smoothstep(0.9, 0.97, length(p) / uR)) * step(uGround, y);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.5 + seed.w) * (1.0 + uLift * 0.7) * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const snowFS = `uniform float uOpacity; varying float vA;
void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)) * vA * uOpacity;
  if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.99, 0.97) * a, a); }`;

export function makeSnow({ count, r = R, box = false, size = 0.09, seed = 7 }) {
  const rand = rng(seed), arr = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let x, z;
    do { x = rand() * 2 - 1; z = rand() * 2 - 1; } while (!box && x * x + z * z > 1);
    arr.set([x, z, rand(), rand()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('seed', new THREE.BufferAttribute(arr, 4));
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: snowVS, fragmentShader: snowFS, transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uSwirl: { value: 0 }, uLift: { value: 0 }, uR: { value: r }, uSize: { value: size },
      uScale: { value: 1000 }, uBox: { value: box ? 1 : 0 }, uGround: { value: -CY * r / R }, uOpacity: { value: 1 },
    },
  });
  const p = new THREE.Points(geo, m);
  p.frustumCulled = false;
  p.renderOrder = 5;
  return p;
}

function snowyTree(rand, k) {
  const g = new THREE.Group();
  const green = mat(0x1d3f3f), white = mat(C.snow);
  for (let i = 0; i < 3; i++) {
    const r = (0.55 - i * 0.14) * k, y = (0.35 + i * 0.38) * k;
    const c = mesh(new THREE.ConeGeometry(r, 0.65 * k, 7), green, 0, y, 0);
    const s = mesh(new THREE.ConeGeometry(r * 0.62, 0.3 * k, 7), white, 0, y + 0.2 * k, 0);
    g.add(c, s);
  }
  g.rotation.y = rand() * 6;
  return g;
}
export { snowyTree };

export function createGlobe(scene) {
  const rig = new THREE.Group();
  scene.add(rig);
  const interior = new THREE.Group();
  rig.add(interior);

  rig.add(makeBase(R));
  const ground = mesh(new THREE.CylinderGeometry(9.56, 9.56, 0.5, 72), mat(0xbac8e6), 0, -0.25, 0);
  ground.castShadow = false;
  rig.add(ground);

  // Ring of trees along the back edge, present in every inside scene.
  const rand = rng(3);
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.92 + 1.16 * (i / 25)) + (rand() - 0.5) * 0.1;
    const rr = 8.2 + rand() * 0.9;
    const tr = snowyTree(rand, 0.75 + rand() * 0.5);
    tr.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    rig.add(tr);
  }

  const glass = makeGlass(R);
  glass.position.y = CY;
  rig.add(glass);

  const snow = makeSnow({ count: 2200, size: 0.075 });
  snow.position.y = CY;
  rig.add(snow);

  // Table: soft pool of light that fades into the background.
  const tableTex = canvasTexture(512, 512, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(58,72,110,1)'); gr.addColorStop(0.18, 'rgba(36,48,82,0.95)');
    gr.addColorStop(0.55, 'rgba(16,26,52,0.6)'); gr.addColorStop(1, 'rgba(10,18,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const table = new THREE.Mesh(new THREE.CircleGeometry(140, 64),
    new THREE.MeshBasicMaterial({ map: tableTex, transparent: true, depthWrite: false }));
  table.rotation.x = -Math.PI / 2; table.position.y = TABLE_Y; table.renderOrder = -2;
  scene.add(table);
  const shadowTex = canvasTexture(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const contact = new THREE.Mesh(new THREE.CircleGeometry(17, 48),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = TABLE_Y + 0.01; contact.renderOrder = -1;
  rig.add(contact);

  const outerSnow = makeSnow({ count: 900, box: true, size: 0.22, seed: 11 });
  scene.add(outerSnow);

  return { rig, interior, glass, snow, outerSnow, table, tableTex };
}
