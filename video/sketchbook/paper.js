// Composites the ink and watercolor canvases onto warm paper in one shader pass.
import * as THREE from 'three';

const P = 512;
// Tileable value noise, built once on the CPU.
function paperTexture() {
  const data = new Uint8Array(P * P * 4);
  const lat = (n, s) => { const a = new Float32Array(n * n); for (let i = 0; i < n * n; i++) { let x = Math.imul(i + s * 7919, 0x9e3779b1); x ^= x >>> 15; x = Math.imul(x, 0x85ebca77); x ^= x >>> 13; a[i] = (x >>> 0) / 4294967296; } return a; };
  const octs = [4, 8, 16, 32, 64, 128].map((n, i) => ({ n, g: lat(n, i + 1), h: lat(n, i + 11) }));
  const sm = k => k * k * (3 - 2 * k);
  const val = (o, g, x, y) => {
    const fx = x * o.n / P, fy = y * o.n / P, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const n = o.n, a = g[(iy % n) * n + ix % n], b = g[(iy % n) * n + (ix + 1) % n], c = g[((iy + 1) % n) * n + ix % n], d = g[((iy + 1) % n) * n + (ix + 1) % n];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    const i = (y * P + x) * 4;
    const tone = val(octs[0], octs[0].g, x, y) * 0.5 + val(octs[1], octs[1].g, x, y) * 0.3 + val(octs[3], octs[3].g, x, y) * 0.2;
    const gran = val(octs[3], octs[3].h, x, y) * 0.4 + val(octs[4], octs[4].h, x, y) * 0.35 + val(octs[5], octs[5].h, x, y) * 0.25;
    const fiber = val(octs[5], octs[5].g, x, y);
    const disp = val(octs[1], octs[1].h, x, y) * 0.6 + val(octs[2], octs[2].h, x, y) * 0.4;
    data[i] = tone * 255; data[i + 1] = gran * 255; data[i + 2] = fiber * 255; data[i + 3] = disp * 255;
  }
  const tex = new THREE.DataTexture(data, P, P, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

const frag = /* glsl */`
precision highp float;
uniform sampler2D tInk, tFill, tPaper;
uniform vec2 uPan; uniform float uBoil;
varying vec2 vUv;
const vec2 RES = vec2(1920.0, 1080.0);
void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * RES;
  vec2 wp = px + uPan;
  vec4 pp = texture2D(tPaper, wp / 512.0);
  vec4 pd = texture2D(tPaper, wp / 900.0 + vec2(uBoil * 0.137, uBoil * 0.071));
  vec4 pf = texture2D(tPaper, wp / 160.0);
  vec3 paper = vec3(0.957, 0.925, 0.858) * (0.955 + 0.06 * pp.r) - (pf.b - 0.5) * 0.03;
  // watercolor: bleed offset, granulation, darker wet edges
  vec2 off = (pd.ag - 0.5) * 9.0 / RES;
  vec2 fu = vUv + off;
  vec4 f = texture2D(tFill, fu);
  vec2 e = 4.0 / RES;
  float ab = 0.25 * (texture2D(tFill, fu + vec2(e.x, 0.0)).a + texture2D(tFill, fu - vec2(e.x, 0.0)).a
                   + texture2D(tFill, fu + vec2(0.0, e.y)).a + texture2D(tFill, fu - vec2(0.0, e.y)).a);
  float edge = clamp((f.a - ab) * 2.5, 0.0, 1.0);
  vec3 fc = f.a > 0.001 ? f.rgb / f.a : vec3(1.0);
  float fa = clamp(f.a * (0.62 + 0.55 * pp.g) + edge * 0.4, 0.0, 1.0);
  vec3 col = paper * mix(vec3(1.0), fc, fa);
  // ink: slightly rough edges and dry-brush texture
  vec4 k = texture2D(tInk, vUv + (pd.ga - 0.5) * 1.6 / RES);
  vec3 kc = k.a > 0.001 ? k.rgb / k.a : vec3(0.0);
  float ka = clamp(k.a * (0.86 + 0.22 * pf.b), 0.0, 1.0);
  col = mix(col, kc * (0.8 + 0.2 * paper), ka);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.28;
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeCompositor(glCanvas, ink, fill) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, preserveDrawingBuffer: true, antialias: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(1920, 1080, false);
  const mk = c => { const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = true; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace; return t; };
  const tInk = mk(ink), tFill = mk(fill);
  const uniforms = { tInk: { value: tInk }, tFill: { value: tFill }, tPaper: { value: paperTexture() }, uPan: { value: new THREE.Vector2() }, uBoil: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }' });
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  return (pan, boil) => {
    uniforms.uPan.value.set(pan[0], pan[1]); uniforms.uBoil.value = boil;
    tInk.needsUpdate = true; tFill.needsUpdate = true;
    renderer.render(scene, cam);
  };
}
