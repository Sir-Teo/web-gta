import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge fixed opaque body pieces. Animated child groups and depth-sorted glass stay separate. */
export function batchVehicleParts(root: THREE.Group) {
  const groups = new Map<string, THREE.Mesh[]>();
  for (const child of root.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || child.material.transparent || !child.visible) continue;
    const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.renderOrder}:${child.layers.mask}`;
    const group = groups.get(key) ?? []; group.push(child); groups.set(key, group);
  }
  const replaced = new Set<THREE.BufferGeometry>();
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map(part => {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      return geometry.applyMatrix4(part.matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!geometry) throw new Error('Vehicle body geometry could not be batched.');
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const first = parts[0], mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = 'Batched vehicle body'; mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
    for (const part of parts) { root.remove(part); replaced.add(part.geometry); }
    root.add(mesh);
  }
  // A geometry can also be used by a retained moving part within this vehicle.
  root.traverse(object => { if (object instanceof THREE.Mesh) replaced.delete(object.geometry); });
  replaced.forEach(geometry => geometry.dispose());
}
