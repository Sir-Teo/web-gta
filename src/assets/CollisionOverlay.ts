import * as THREE from 'three';
import type { ColModel } from './col';
import type { IplInstance } from './ipl';
import { placementMatrix } from './placement';
export function collisionOverlay(model: ColModel, placements?: IplInstance[]) {
  const count = placements?.length ?? 1;
  const lines = model.spheres.length * 500 + model.boxes.length * 12 + model.mesh.indices.length;
  if (count > 4096 || lines * count > 2000000) throw new Error('Collision overlay exceeds the line or placement limit.');
  const source = new THREE.Group(), root = new THREE.Group(), geometries = new Set<THREE.BufferGeometry>();
  const material = new THREE.LineBasicMaterial({ color: 0x55ff99, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });
  const wire = (geometry: THREE.BufferGeometry, edges = false) => {
    const result = edges ? new THREE.EdgesGeometry(geometry) : new THREE.WireframeGeometry(geometry); geometry.dispose(); geometries.add(result); return result;
  };
  const sphere = model.spheres.length ? wire(new THREE.SphereGeometry(1, 12, 8)) : null;
  for (const volume of model.spheres) { const line = new THREE.LineSegments(sphere!, material); line.position.fromArray(volume.center); line.scale.setScalar(volume.radius); source.add(line); }
  const box = model.boxes.length ? wire(new THREE.BoxGeometry(1, 1, 1), true) : null;
  for (const volume of model.boxes) {
    const line = new THREE.LineSegments(box!, material);
    line.position.set(...volume.max.map((n, i) => (n + volume.min[i]) / 2) as [number, number, number]);
    line.scale.set(...volume.max.map((n, i) => n - volume.min[i]) as [number, number, number]); source.add(line);
  }
  if (model.mesh.indices.length) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(model.mesh.positions, 3)); geometry.setIndex(new THREE.BufferAttribute(model.mesh.indices, 1));
    source.add(new THREE.LineSegments(wire(geometry), material));
  }
  if (placements) for (const placement of placements) { const instance = source.clone(true); instance.matrixAutoUpdate = false; instance.matrix.copy(placementMatrix(placement)); root.add(instance); }
  else { source.rotation.x = -Math.PI / 2; root.add(source); }
  root.updateMatrixWorld(true); let disposed = false;
  return { root, dispose: () => { if (disposed) return; disposed = true; geometries.forEach(g => g.dispose()); material.dispose(); } };
}
