// Beat 9: a small snow globe holding the MiceMax logo, in its own scene over a darkened backdrop.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { C, mat, mesh, prog, ease, lerp, rng, glow } from './lib.js';
import { makeGlass, makeBase, makeSnow, snowyTree } from './globe.js';

export const T9 = 28.45;

export async function createLogo() {
  const svg = await fetch('logo.svg').then(r => r.text());
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  cam.position.set(0, 0, 25);
  cam.updateMatrixWorld();

  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a2238, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.4); key.position.set(-4, 6, 8); scene.add(key);

  const shade = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshBasicMaterial({ color: 0x07102a, transparent: true, opacity: 0, depthWrite: false }));
  shade.position.z = -20; scene.add(shade);

  const g = new THREE.Group(); scene.add(g);
  const R = 4.2, k = R / 10;
  g.add(makeBase(R, 1.5));
  const rand = rng(8);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.05 + 0.9 * i / 8), tr = snowyTree(rand, 0.32 + rand() * 0.18);
    tr.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 2.6); g.add(tr);
  }
  const halo = glow(0xffb34a, 5.5, 0.5); halo.position.set(0, 2.1, -0.6); g.add(halo);
  g.add(mesh(new THREE.CylinderGeometry(9.5 * k, 9.5 * k, 0.2, 48), mat(0xbac8e6), 0, -0.1, 0, false));
  const glass = makeGlass(R, -3 * k); glass.position.y = 3 * k; g.add(glass);
  const snow = makeSnow({ count: 260, r: R, size: 0.06, seed: 41 }); snow.position.y = 3 * k; g.add(snow);

  // Extruded logo from the favicon path
  const data = new SVGLoader().parse(svg);
  const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 14, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 10 });
  geo.center();
  const logo = new THREE.Mesh(geo, mat(0xffd37a, { emissive: 0x6a3d00 }));
  logo.scale.set(0.026, -0.026, 0.026);
  logo.position.y = 2.1;
  g.add(logo);

  return {
    scene, cam,
    update(t, fromNDC) {
      const on = t > T9 - 0.05;
      scene.visible = on;
      if (!on) return false;
      const u = ease.inOut(prog(t, T9, T9 + 0.75));
      shade.material.opacity = 0.96 * ease.inOut(prog(t, T9, T9 + 0.55));
      // fly from the Sapporo light on the map to the center
      const dir = new THREE.Vector3(fromNDC.x, fromNDC.y, 0.5).unproject(cam).sub(cam.position).normalize();
      const start = cam.position.clone().addScaledVector(dir, -cam.position.z / dir.z);
      const end = new THREE.Vector3(0, 0.6, 0);
      g.position.lerpVectors(start, end, u);
      const s = Math.max(1e-4, lerp(0.03, 1, u) * (1 + 0.05 * Math.sin(prog(t, T9 + 0.6, T9 + 1.1) * Math.PI)));
      g.scale.setScalar(s);
      g.rotation.set(0.18, lerp(-1.2, 0, u) + Math.sin(t * 0.8) * 0.08, 0);
      logo.rotation.y = Math.sin(t * 1.3) * 0.35;
      snow.material.uniforms.uTime.value = t;
      snow.material.uniforms.uSwirl.value = (1 - u) * 4;
      snow.material.uniforms.uLift.value = (1 - u) * 0.6;
      return true;
    },
  };
}
