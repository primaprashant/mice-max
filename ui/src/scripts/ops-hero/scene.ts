// Renderer, camera, bloom, controls and the frame loop for the agent network.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { DEPTS, HUMAN } from '../../data/ops-home';
import { buildNodes, updateNodes, type HeroNode } from './nodes';
import { Particles, starField } from './particles';
import { Bubbles, HoverLabel, deptLabel, injectStyles, lang } from './bubbles';
import { Story } from './script';

const BG = '#05070d';
const NETWORK_WIDTH = 30; // world units the camera keeps in view horizontally
// Department label anchors: [node id, dx, dy], kept clear of the bottom counters band.
const DEPT_LABEL_AT: Record<string, [string, number, number]> = {
  setup: ['audience', 1.6, -1.9],
  operations: ['host-assigner', 0, 1.6],
  growth: ['sales', 0, 1.7],
  reporting: ['city-report', 0.4, -1.4],
};

export class Hero {
  private renderer: THREE.WebGLRenderer;
  private labels = new CSS2DRenderer();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private nodes: Map<string, HeroNode>;
  private particles: Particles;
  private bubbles = new Bubbles();
  private hover = new HoverLabel();
  private story: Story;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9);
  private parallax = new THREE.Vector2();
  private last = 0;
  private elapsed = 0;
  private frame = 0;
  private running = false;
  private narrow = false;

  constructor(private el: HTMLElement, private still: boolean) {
    injectStyles();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setClearColor(BG, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none';
    this.labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    el.style.overflow = 'hidden';
    el.append(canvas, this.labels.domElement);

    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.FogExp2(BG, 0.012);
    this.narrow = el.clientWidth < 768;
    this.bubbles.max = this.narrow ? 1 : 3;

    const built = buildNodes(this.root);
    this.nodes = built.nodes;
    this.particles = new Particles(this.narrow ? 700 : 1600, built.edges, this.narrow ? 30 : 70, pr);
    this.root.add(this.particles.points);
    this.scene.add(this.root, starField(this.narrow ? 500 : 1200, pr));
    this.addDeptLabels();
    this.story = new Story(this.root, this.nodes, built.edges, this.particles, this.bubbles, this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.5, 0.22);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.camera.position.set(0, 2, 34);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableZoom: false, enablePan: false, enableDamping: !still, dampingFactor: 0.06,
      rotateSpeed: 0.5,
      minPolarAngle: Math.PI * 0.32, maxPolarAngle: Math.PI * 0.62,
      minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9,
    });
    // Touch screens keep vertical page scroll; dragging only rotates with a mouse.
    if (matchMedia('(pointer: coarse)').matches) {
      this.controls.enableRotate = false;
      canvas.style.touchAction = 'pan-y';
    }
    if (still) this.controls.addEventListener('change', () => this.render());
    this.bindPointer(canvas);
    this.resize();
    this.particles.prefill();
  }

  private addDeptLabels() {
    const ja = lang() === 'ja';
    for (const d of DEPTS) {
      const [id, dx, dy] = DEPT_LABEL_AT[d.id];
      const at = this.nodes.get(id)!.group.position.clone().add(new THREE.Vector3(dx, dy, 0));
      this.root.add(deptLabel(ja ? d.ja : d.en, d.color, at));
    }
    const h = this.nodes.get(HUMAN.id)!;
    this.root.add(deptLabel(ja ? HUMAN.label_ja : HUMAN.label_en, '#ffe2b8', h.group.position.clone().add(new THREE.Vector3(0, -2.3, 0))));
  }

  private bindPointer(canvas: HTMLCanvasElement) {
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (this.still && this.pick()) this.renderStill();
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer.set(9, 9);
      this.setHover(null);
      if (this.still) this.renderStill();
    });
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pick();
      const link = this.hover.current?.agent?.link;
      if (link) window.location.href = link;
    });
  }

  /** Raycast the pointer against the nodes; returns true if the hover changed. */
  private pick(): boolean {
    const before = this.hover.current;
    if (Math.abs(this.pointer.x) > 1) {
      this.setHover(null);
      return before !== null;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.nodes.values()].map((n) => n.hit), false);
    this.setHover(hits.length ? this.nodes.get(hits[0].object.userData.id)! : null);
    return before !== this.hover.current;
  }

  private setHover(n: HeroNode | null) {
    this.hover.set(n);
    this.renderer.domElement.style.cursor = n?.agent ? 'pointer' : '';
    for (const node of this.nodes.values()) node.hover = node === n ? 1 : 0;
  }

  resize() {
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.narrow = w < 768;
    this.camera.aspect = w / h;
    // Wide screens: the network fills the right ~60% (the headline sits on the left) and
    // sits a little high to clear the counters. Narrow: fit the width, centred.
    const wide = w >= 1024;
    const share = wide ? 0.6 : 0.95;
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(32, NETWORK_WIDTH / 2 / (Math.tan(halfV) * this.camera.aspect) / share);
    this.camera.position.setLength(dist);
    (this.scene.fog as THREE.FogExp2).density = 0.4 / dist; // same haze at any camera distance
    if (wide) this.camera.setViewOffset(w, h, -w * 0.19, h * 0.07, w, h);
    else this.camera.setViewOffset(w, h, 0, h * 0.07, w, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.labels.setSize(w, h);
    if (this.still || !this.running) this.render();
  }

  private render(dt?: number) {
    // Still mode renders on the controls' own change events, so don't update (and re-fire) here.
    if (!this.still) this.controls.update(dt);
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  private tick = () => {
    this.frame = requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.elapsed += dt;
    // Mouse parallax: tilt the network slightly towards the pointer.
    const px = Math.abs(this.pointer.x) > 1 ? 0 : this.pointer.x;
    const py = Math.abs(this.pointer.y) > 1 ? 0 : this.pointer.y;
    this.parallax.lerp(new THREE.Vector2(px, py), 1 - Math.exp(-dt * 2.5));
    // Slow sway instead of a full orbit, so the clusters never line up behind each other.
    this.root.rotation.y = Math.sin(this.elapsed * 0.13) * (this.narrow ? 0.22 : 0.36) + this.parallax.x * 0.12;
    this.root.rotation.x = -this.parallax.y * 0.07;
    this.story.update(dt);
    this.particles.update(dt);
    this.bubbles.update(dt);
    updateNodes(this.nodes, this.elapsed, dt);
    this.pick();
    this.render(dt);
  };

  /** A single composed frame for reduced motion. */
  renderStill() {
    updateNodes(this.nodes, 0, 0);
    this.particles.update(0);
    this.render();
  }

  start() {
    if (this.running || this.still) return;
    this.running = true;
    this.last = performance.now();
    this.tick();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
