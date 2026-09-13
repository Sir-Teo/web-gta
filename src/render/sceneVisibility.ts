import { Box3, Frustum, Matrix4, Sphere, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { ScenePart } from '../assets/scene';
import { planSceneCollision } from '../assets/sceneCollision';
import { requireAsset } from '../assets/binary';
import { placementMatrix } from '../assets/placement';

/** Loaded-scene distance and sphere-frustum selection. Source fades/occlusion remain separate. */
export function sceneVisibility(parts: ScenePart[], roots: Object3D[]) {
  const graph = planSceneCollision(parts), offsets: number[] = [];
  let offset = 0;
  const entries = parts.flatMap((part, partIndex) => {
    offsets.push(offset); offset += part.placements.length;
    const distance = part.definition?.drawDistance ?? Infinity;
    requireAsset(distance >= 0 && (Number.isFinite(distance) || distance === Infinity), 'Invalid scene draw distance.');
    return part.placements.map((placement, index) => {
      const object = roots[partIndex].children[index];
      const bounds = part.visibilityBounds?.bounds ?? part.collision?.bounds;
      let sphere: Sphere | undefined;
      if (bounds) {
        requireAsset(Number.isFinite(bounds.radius) && bounds.radius >= 0 && bounds.center.every(Number.isFinite), 'Invalid scene visibility sphere.');
        sphere = new Sphere(new Vector3(...bounds.center), bounds.radius).applyMatrix4(placementMatrix(placement));
      } else {
        // Static imported geometry fallback. Empty/unknown bounds remain conservative.
        const box = new Box3().setFromObject(object);
        if (!box.isEmpty()) sphere = box.getBoundingSphere(new Sphere());
      }
      return {
        object, root: roots[partIndex], part: partIndex, sphere,
        origin: new Vector3(placement.position[0], placement.position[2], -placement.position[1]),
        distance, radius: bounds?.radius ?? sphere?.radius ?? 0,
        parent: -1, children: [] as number[], selected: true, covered: false,
      };
    });
  });
  for (const node of graph.nodes.values()) {
    const target = node.target && graph.nodes.get(node.target);
    if (!target) continue;
    const child = offsets[node.part] + node.placement, parent = offsets[target.part] + target.placement;
    entries[child].parent = parent; entries[parent].children.push(child);
  }
  // Child-first order is independent of model grouping and uses no recursive stack.
  const pending = entries.map(e => e.children.length), order: number[] = [];
  pending.forEach((count, i) => { if (!count) order.push(i); });
  for (let i = 0; i < order.length; i++) {
    const parent = entries[order[i]].parent;
    if (parent >= 0 && --pending[parent] === 0) order.push(parent);
  }
  const frustum = new Frustum(), projectionView = new Matrix4(), cameraPosition = new Vector3();
  const update = (camera: PerspectiveCamera) => {
    camera.updateWorldMatrix(true, false);
    cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView, camera.coordinateSystem, camera.reversedDepth);
    for (const index of order) {
      const entry = entries[index], origin = entry.parent < 0 ? entry.origin : entries[entry.parent].origin;
      const range = Math.min(entry.distance, camera.far + entry.radius);
      const childRendered = entry.children.some(child => entries[child].covered);
      entry.selected = entry.root.visible && origin.distanceToSquared(cameraPosition) < range * range && !childRendered
        && (!entry.sphere || frustum.intersectsSphere(entry.sphere));
      entry.covered = entry.selected || childRendered;
      entry.object.visible = entry.selected;
    }
  };
  return { update, get count() { return entries.reduce((n, e) => n + Number(e.root.visible && e.object.visible), 0); },
    models: () => parts.flatMap((part, i) => entries.some(e => e.part === i && e.root.visible && e.object.visible) ? [part.name] : []) };
}
