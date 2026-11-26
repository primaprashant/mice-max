// Agent nodes, their 3D layout by department, and the curved edges between them.
import * as THREE from 'three';
import { AGENTS, EDGES, HUMAN, deptColor, type Agent } from '../../data/ops-home';

export const HUMAN_COLOR = new THREE.Color('#ffe2b8');
export const AMBER = new THREE.Color('#ffb020');

export interface HeroNode {
  id: string;
  agent?: Agent; // undefined for the human
  color: THREE.Color;
  radius: number;
  group: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Sprite;
  shell: THREE.LineSegments;
  hit: THREE.Mesh;
  phase: number;
  dim: boolean;
  energy: number; // 0..1, flashes when work arrives
  alert: number; // 0..1, amber tint
  hover: number; // 0..1, eased
}

export interface Edge {
  from: string;
  to: string;
  curve: THREE.CatmullRomCurve3;
}

/** Positions per agent id. The setup chain winds across the left; operations form a
 * ring on the right; growth sits on top; reporting below; the human near the centre. */
function layout(): Record<string, THREE.Vector3> {
  const pos: Record<string, THREE.Vector3> = {};
  const setup = AGENTS.filter((a) => a.dept === 'setup');
  setup.forEach((a, i) => {
    const t = i / (setup.length - 1);
    pos[a.id] = new THREE.Vector3(-13.5 + t * 11.5, -5 + 10 * t ** 1.5, 1.8 * Math.sin(t * Math.PI * 2));
  });
  const ops = AGENTS.filter((a) => a.dept === 'operations');
  ops.forEach((a, i) => {
    const ang = (i / ops.length) * Math.PI * 2 + 2.4;
    pos[a.id] = new THREE.Vector3(7 + Math.cos(ang) * 4, Math.sin(ang) * 3.6, Math.sin(ang * 2) * 2.2 - 1);
  });
  pos['sales'] = new THREE.Vector3(-1.5, 8.6, -3.5);
  pos['reporter'] = new THREE.Vector3(5.5, -6.8, -1.5);
  pos['city-report'] = new THREE.Vector3(10.5, -7.2, -3.5);
  pos[HUMAN.id] = new THREE.Vector3(0.4, -2, 3);
  return pos;
}

let haloTexture: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(c);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

function makeNode(id: string, pos: THREE.Vector3, color: THREE.Color, radius: number, agent?: Agent): HeroNode {
  const group = new THREE.Group();
  group.position.copy(pos);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshBasicMaterial({ color: color.clone(), toneMapped: false }),
  );
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  halo.scale.setScalar(radius * 8);
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(radius * 1.9, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  // Bigger invisible sphere so small nodes are easy to hover and click.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.id = id;
  group.add(halo, shell, core, hit);
  const dim = agent?.mode === 'next';
  return {
    id, agent, color, radius, group, core, halo, shell, hit,
    phase: Math.random() * Math.PI * 2, dim, energy: 0, alert: 0, hover: 0,
  };
}

export function buildNodes(root: THREE.Group): { nodes: Map<string, HeroNode>; edges: Edge[] } {
  const pos = layout();
  const nodes = new Map<string, HeroNode>();
  for (const a of AGENTS) {
    const n = makeNode(a.id, pos[a.id], new THREE.Color(deptColor(a.dept)), 0.42, a);
    nodes.set(a.id, n);
    root.add(n.group);
  }
  const human = makeNode(HUMAN.id, pos[HUMAN.id], HUMAN_COLOR.clone(), 0.75);
  // Two tilted rings mark the human as different from the agents.
  for (const tilt of [0.4, -0.9]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.025, 8, 96),
      new THREE.MeshBasicMaterial({ color: HUMAN_COLOR, transparent: true, opacity: 0.55, toneMapped: false }),
    );
    ring.rotation.set(Math.PI / 2 + tilt, tilt, 0);
    ring.userData.spin = tilt;
    human.group.add(ring);
  }
  nodes.set(HUMAN.id, human);
  root.add(human.group);

  const edges = EDGES.map(([a, b]) => ({ from: a, to: b, curve: curveBetween(pos[a], pos[b]) }));
  const lineMat = new THREE.LineBasicMaterial({
    color: '#7dd3fc', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const humanMat = lineMat.clone();
  humanMat.color.copy(HUMAN_COLOR);
  humanMat.opacity = 0.12;
  for (const e of edges) {
    const geo = new THREE.BufferGeometry().setFromPoints(e.curve.getPoints(48));
    root.add(new THREE.Line(geo, e.to === HUMAN.id ? humanMat : lineMat));
  }
  return { nodes, edges };
}

/** A gentle arc from a to b, bowed sideways and towards the viewer. */
export function curveBetween(a: THREE.Vector3, b: THREE.Vector3, bow = 0.18): THREE.CatmullRomCurve3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const side = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(dir.length() * bow);
  mid.add(side).add(new THREE.Vector3(0, 0, dir.length() * 0.12));
  return new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()]);
}

const tmp = new THREE.Color();
/** Per-frame look: breathing, flashes, amber alerts and hover. */
export function updateNodes(nodes: Map<string, HeroNode>, t: number, dt: number) {
  for (const n of nodes.values()) {
    n.energy *= Math.exp(-dt * 1.8);
    n.alert *= Math.exp(-dt * 0.45);
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.3 + n.phase);
    tmp.copy(n.color).lerp(AMBER, Math.min(1, n.alert * 1.4));
    const base = n.dim ? 0.45 : 0.8;
    n.core.material.color.copy(tmp).multiplyScalar(base + breathe * 0.2 + n.energy * 2.6 + n.hover * 0.6);
    const haloMat = n.halo.material as THREE.SpriteMaterial;
    haloMat.color.copy(tmp);
    haloMat.opacity = (n.dim ? 0.12 : 0.26) + breathe * 0.06 + n.energy * 0.55 + n.alert * 0.3;
    n.halo.scale.setScalar(n.radius * (6.5 + n.energy * 7 + n.alert * 5 + n.hover * 2));
    const s = 1 + n.energy * 0.35 + n.hover * 0.3;
    n.core.scale.setScalar(s);
    n.shell.scale.setScalar(s * (1 + n.energy * 0.25));
    n.shell.rotation.y = t * 0.25 + n.phase;
    n.shell.rotation.x = t * 0.15;
    (n.shell.material as THREE.LineBasicMaterial).color.copy(tmp);
    (n.shell.material as THREE.LineBasicMaterial).opacity = (n.dim ? 0.1 : 0.2) + n.energy * 0.5 + n.hover * 0.4;
    for (const child of n.group.children) {
      if (child.userData.spin !== undefined) child.rotation.z = t * 0.4 * Math.sign(child.userData.spin);
    }
  }
}
