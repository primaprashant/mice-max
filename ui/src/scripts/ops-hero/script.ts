// The scripted ~40 s story loop: a conference arrives, setup runs, operations fan out,
// snow forces a replan, a hand-off reaches the human, reports go out, sales finds the next one.
import * as THREE from 'three';
import { AGENTS, LOOP_SECONDS, SCRIPT, type Beat } from '../../data/ops-home';
import { AMBER, curveBetween, type Edge, type HeroNode } from './nodes';
import type { Particles } from './particles';
import { Bubbles, cometLabel } from './bubbles';

const SETUP_CHAIN = AGENTS.filter((a) => a.dept === 'setup').map((a) => a.id);
const WHITE = new THREE.Color('#ffffff');
const tmpQ = new THREE.Quaternion();

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  delay: number;
}

export class Story {
  private time = 0;
  private next = 0;
  private rings: Ring[] = [];
  private adhoc = new Map<string, THREE.CatmullRomCurve3>();
  private timers: { at: number; fn: () => void }[] = [];

  constructor(
    private root: THREE.Group,
    private nodes: Map<string, HeroNode>,
    private edges: Edge[],
    private particles: Particles,
    private bubbles: Bubbles,
    private camera: THREE.Camera,
  ) {}

  /** The curve from a to b, plus whether to travel it backwards. */
  private path(a: string, b: string): { curve: THREE.Curve<THREE.Vector3>; reverse: boolean } {
    const e = this.edges.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
    if (e) return { curve: e.curve, reverse: e.from !== a };
    const key = `${a}>${b}`;
    if (!this.adhoc.has(key)) this.adhoc.set(key, curveBetween(this.pos(a), this.pos(b), 0.3));
    return { curve: this.adhoc.get(key)!, reverse: false };
  }

  private pos(id: string) {
    return this.nodes.get(id)!.group.position;
  }

  private after(delay: number, fn: () => void) {
    this.timers.push({ at: this.time + delay, fn });
  }

  private arrive(id: string, beat: Beat, extra: { alert?: boolean; wave?: boolean } = {}) {
    const n = this.nodes.get(id)!;
    n.energy = 1;
    if (extra.alert) n.alert = 1;
    if (beat.bubble) this.bubbles.show(n, beat.bubble, { color: extra.alert ? AMBER : undefined, wave: extra.wave });
  }

  private send(from: string, to: string, opts: {
    color?: THREE.Color; size?: number; speed?: number; trail?: boolean; jitter?: number;
    onArrive?: () => void; follow?: THREE.Object3D;
  } = {}) {
    const { curve, reverse } = this.path(from, to);
    const j = opts.jitter ?? 0;
    this.particles.spawn({
      curve, reverse, speed: opts.speed ?? 0.8,
      color: (opts.color ?? this.nodes.get(from)!.color).clone().multiplyScalar(2.2),
      size: opts.size ?? 2.4, alpha: 1, trail: opts.trail ?? true,
      offset: new THREE.Vector3((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j),
      onArrive: opts.onArrive, follow: opts.follow,
    });
  }

  private comet(beat: Beat) {
    const to = beat.to!;
    const label = beat.label ? cometLabel(beat.label) : undefined;
    if (label) this.root.add(label);
    const onArrive = () => {
      label?.removeFromParent();
      label?.element.remove();
      this.arrive(to, beat);
      this.ring(to, WHITE, 1);
    };
    const common = { color: WHITE, size: 4.5, trail: true, onArrive, follow: label };
    if (beat.from) {
      this.send(beat.from, to, { ...common, speed: 0.45 });
      this.arrive(beat.from, { ...beat, bubble: undefined });
    } else {
      const end = this.pos(to);
      const start = end.clone().add(new THREE.Vector3(-22, -10, 12));
      const mid = start.clone().lerp(end, 0.55).add(new THREE.Vector3(2, -4, 4));
      const curve = new THREE.CatmullRomCurve3([start, mid, end.clone()]);
      this.particles.spawn({ curve, speed: 0.42, color: WHITE.clone().multiplyScalar(2.5), size: 4.5, trail: true, onArrive, follow: label });
    }
  }

  private ring(id: string, color: THREE.Color, count: number) {
    const n = this.nodes.get(id)!;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.94, 1, 64),
        new THREE.MeshBasicMaterial({
          color: color.clone().multiplyScalar(2), transparent: true, opacity: 0, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }),
      );
      mesh.scale.setScalar(n.radius);
      n.group.add(mesh);
      this.rings.push({ mesh, age: 0, delay: i * 0.45 });
    }
  }

  private run(beat: Beat) {
    switch (beat.kind) {
      case 'comet':
        this.comet(beat);
        break;
      case 'chain': {
        const i = SETUP_CHAIN.indexOf(beat.node!);
        this.send(SETUP_CHAIN[i - 1], beat.node!, { size: 3.2, speed: 0.75, color: WHITE, onArrive: () => this.arrive(beat.node!, beat) });
        break;
      }
      case 'burst':
        for (let k = 0; k < 36; k++) {
          this.after(k * 0.035, () => this.send(beat.from!, beat.to!, {
            size: 1.2 + Math.random(), speed: 0.55 + Math.random() * 0.4, trail: false, jitter: 1.2,
            onArrive: k === 0 ? () => this.arrive(beat.to!, beat) : () => { this.nodes.get(beat.to!)!.energy = Math.min(1, this.nodes.get(beat.to!)!.energy + 0.1); },
          }));
        }
        break;
      case 'ring':
        this.send('writer', beat.node!, { size: 2.6, speed: 0.9, onArrive: () => {
          this.arrive(beat.node!, beat, { wave: true });
          this.ring(beat.node!, this.nodes.get(beat.node!)!.color, 3);
        } });
        break;
      case 'sparks':
        for (let k = 0; k < 6; k++) {
          const out = k % 2 === 0;
          this.after(k * 0.4, () => this.send(out ? beat.from! : beat.to!, out ? beat.to! : beat.from!, {
            size: 2, speed: 1.3, onArrive: k === 0 ? () => this.arrive(beat.to!, beat) : () => { this.nodes.get(out ? beat.to! : beat.from!)!.energy = 0.8; },
          }));
        }
        break;
      case 'alert':
        this.arrive(beat.node!, beat, { alert: true });
        this.ring(beat.node!, AMBER, 2);
        // Reroute: the replanner pushes new plans back to the booker and concierge.
        for (const id of ['booker', 'concierge']) {
          for (let k = 0; k < 4; k++) this.after(0.6 + k * 0.18, () => this.send(beat.node!, id, { color: AMBER, size: 1.8, speed: 0.8, jitter: 0.4 }));
        }
        break;
      case 'spark':
        this.send(beat.from!, beat.to!, { size: 3.2, speed: 0.6, color: this.nodes.get(beat.to!)!.color, onArrive: () => {
          this.arrive(beat.to!, beat);
          this.ring(beat.to!, this.nodes.get(beat.to!)!.color, 2);
        } });
        this.arrive(beat.from!, { ...beat, bubble: undefined });
        break;
      case 'flow':
        for (let k = 0; k < 12; k++) {
          this.after(k * 0.12, () => this.send(beat.from!, beat.to!, {
            size: 1.6, speed: 0.7, trail: false, jitter: 0.35,
            onArrive: k === 0 ? () => this.arrive(beat.to!, beat) : undefined,
          }));
        }
        break;
    }
  }

  update(dt: number) {
    this.time += dt;
    const loopT = this.time % LOOP_SECONDS;
    if (loopT < (this.time - dt) % LOOP_SECONDS) this.next = 0; // wrapped
    while (this.next < SCRIPT.length && SCRIPT[this.next].at <= loopT) this.run(SCRIPT[this.next++]);

    const due = this.timers.filter((x) => x.at <= this.time);
    if (due.length) {
      this.timers = this.timers.filter((x) => x.at > this.time);
      due.forEach((x) => x.fn());
    }

    for (const r of [...this.rings]) {
      r.age += dt;
      const t = (r.age - r.delay) / 1.4;
      if (t < 0) continue;
      if (t >= 1) {
        r.mesh.removeFromParent();
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings = this.rings.filter((x) => x !== r);
        continue;
      }
      r.mesh.parent!.getWorldQuaternion(tmpQ).invert();
      r.mesh.quaternion.copy(tmpQ.multiply(this.camera.quaternion));
      r.mesh.scale.setScalar(0.6 + t * 2.2);
      r.mesh.material.opacity = (1 - t) * 0.7;
    }
  }
}

