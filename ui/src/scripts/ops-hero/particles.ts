// One pooled point cloud for every moving light: ambient drift, pulses, comets and trails.
import * as THREE from 'three';
import type { Edge } from './nodes';

export interface Particle {
  curve?: THREE.Curve<THREE.Vector3>;
  t: number; // 0..1 along the curve
  speed: number; // curve lengths per second
  reverse: boolean;
  offset: THREE.Vector3; // small sideways jitter
  pos: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number; // seconds left, for dust without a curve
  maxLife: number;
  trail: boolean; // leaves dust behind
  ambient: boolean;
  onArrive?: () => void;
  follow?: THREE.Object3D; // e.g. a comet label
}

const VERT = /* glsl */ `
  attribute float size;
  attribute vec4 tint;
  varying vec4 vTint;
  uniform float pixelRatio;
  void main() {
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio * (220.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  varying vec4 vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  }`;

export function pointsMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { pixelRatio: { value: pixelRatio } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export class Particles {
  points: THREE.Points;
  private list: Particle[] = [];
  private pos: Float32Array;
  private tint: Float32Array;
  private size: Float32Array;
  private ambientTimer = 0;

  constructor(private max: number, private edges: Edge[], private ambientTarget: number, pixelRatio: number) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, pointsMaterial(pixelRatio));
    this.points.frustumCulled = false;
  }

  spawn(p: Partial<Particle> & { color: THREE.Color }): Particle | undefined {
    if (this.list.length >= this.max) {
      // Drop the oldest ambient particle to make room for scripted ones.
      const i = this.list.findIndex((q) => q.ambient);
      if (i < 0 || p.ambient) return;
      this.list.splice(i, 1);
    }
    const q: Particle = {
      t: 0, speed: 0.6, reverse: false, offset: new THREE.Vector3(), pos: new THREE.Vector3(),
      size: 1, alpha: 1, life: 1, maxLife: 1, trail: false, ambient: false, ...p,
    };
    if (q.curve) this.place(q);
    this.list.push(q);
    return q;
  }

  private place(q: Particle) {
    q.curve!.getPointAt(q.reverse ? 1 - q.t : q.t, q.pos);
    q.pos.add(q.offset);
  }

  /** Faint particles drifting along random edges so the scene never looks idle. */
  private spawnAmbient(prefill = false) {
    const e = this.edges[Math.floor(Math.random() * this.edges.length)];
    this.spawn({
      curve: e.curve, t: prefill ? Math.random() : 0, speed: 0.08 + Math.random() * 0.12,
      color: new THREE.Color().setHSL(0.55 + Math.random() * 0.2, 0.8, 0.7),
      size: 0.5 + Math.random() * 0.6, alpha: 0.35 + Math.random() * 0.3, ambient: true,
    });
  }

  prefill() {
    for (let i = 0; i < this.ambientTarget; i++) this.spawnAmbient(true);
  }

  update(dt: number) {
    const ambient = this.list.reduce((n, q) => n + (q.ambient ? 1 : 0), 0);
    this.ambientTimer -= dt;
    if (ambient < this.ambientTarget && this.ambientTimer <= 0) {
      this.spawnAmbient();
      this.ambientTimer = 0.04;
    }
    const done: Particle[] = [];
    for (const q of this.list) {
      if (q.curve) {
        q.t += q.speed * dt;
        if (q.t >= 1) {
          q.t = 1;
          done.push(q);
        }
        this.place(q);
        if (q.trail) {
          this.spawn({
            pos: q.pos.clone(), color: q.color.clone(), size: q.size * 0.7, alpha: q.alpha * 0.6,
            life: 0.7, maxLife: 0.7,
          });
        }
        q.follow?.position.copy(q.pos);
      } else {
        q.life -= dt;
        if (q.life <= 0) done.push(q);
      }
    }
    if (done.length) {
      this.list = this.list.filter((q) => !done.includes(q));
      for (const q of done) q.onArrive?.();
    }
    this.write();
  }

  private write() {
    const n = this.list.length;
    for (let i = 0; i < n; i++) {
      const q = this.list[i];
      const fade = q.curve ? Math.min(1, q.t * 8, (1 - q.t) * 8 + (q.ambient ? 0 : 1)) : q.life / q.maxLife;
      const k = q.curve ? 1 : fade;
      this.pos.set([q.pos.x, q.pos.y, q.pos.z], i * 3);
      this.tint.set([q.color.r, q.color.g, q.color.b, q.alpha * fade], i * 4);
      this.size[i] = q.size * (0.4 + 0.6 * k);
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    for (const name of ['position', 'tint', 'size']) geo.getAttribute(name).needsUpdate = true;
  }
}

/** A distant star field for depth. Static. */
export function starField(count: number, pixelRatio: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const tint = new Float32Array(count * 4);
  const size = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 60;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th) - 20], i * 3);
    c.setHSL(0.58 + Math.random() * 0.15, 0.5, 0.75);
    tint.set([c.r, c.g, c.b, 0.15 + Math.random() * 0.35], i * 4);
    size[i] = 0.6 + Math.random() * 1.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  return new THREE.Points(geo, pointsMaterial(pixelRatio));
}
