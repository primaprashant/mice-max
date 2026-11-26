// Puffy low-poly clouds that drift slowly; they fill the sky around the floating pieces.
import * as THREE from 'three';
import { mergeGeometries } from '/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './util.js';

// [x, y, z, size]
const SPOTS = [[-4, 7.8, -8, 1.6], [8.5, 8.2, -7, 1.8], [-5.5, 10.8, -4.5, 1.1], [9.5, 11.2, -4.5, 1.0], [-7.5, 4.5, -5, 1.0],
  [9, 4, -4.5, 1.2], [1, 13.5, -11, 2.0], [-38, 14, 18, 6], [70, 18, -50, 8], [40, 22, 50, 7], [-160, 30, 150, 25], [120, 35, 120, 22]];

export function buildClouds() {
  const R = rng(17), parts = [];
  for (let i = 0; i < 7; i++) {
    const s = 0.35 + R() * 0.35, g = new THREE.IcosahedronGeometry(s, 1);
    g.translate((i - 3) * 0.32 + (R() - 0.5) * 0.2, s * 0.4 + (3 - Math.abs(i - 3)) * 0.06, (R() - 0.5) * 0.4);
    parts.push(g);
  }
  const geo = mergeGeometries(parts); geo.scale(1, 0.75, 0.9);
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, m, SPOTS.length);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(t) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
      SPOTS.forEach(([x, y, z, sz], i) => {
        m4.compose(v.set(x + t * 0.04 * sz, y + Math.sin(t * 0.5 + i) * 0.05 * sz, z), q, s.setScalar(sz)); mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
