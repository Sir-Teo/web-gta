import { Box3, Frustum, Matrix4, Sphere, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { ScenePart } from '../assets/scene';
import { planSceneCollision, isDistanceBigBuilding } from '../assets/sceneCollision';
import { requireAsset } from '../assets/binary';
import { placementMatrix } from '../assets/placement';
import { placementFade } from './placementFade';
import { distanceFadeAlpha, distanceFadeWidth } from './distanceFade';

/** Loaded-scene distance fading and sphere-frustum selection. Source streaming/occlusion remain separate. */
export function sceneVisibility(parts: ScenePart[], roots: Object3D[]) {
  const graph = planSceneCollision(parts), offsets: number[] = [];
  let offset = 0;
  const entries = parts.flatMap((part, partIndex) => {
    offsets.push(offset); offset += part.placements.length;
    const distance = part.definition?.drawDistance ?? Infinity;
    requireAsset(distance >= 0 && (Number.isFinite(distance) || distance === Infinity), 'Invalid scene draw distance.');
    roots[partIndex].updateMatrixWorld(true);
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
        object, root: roots[partIndex], part: partIndex, sphere, interior: placement.interior,
        origin: new Vector3(placement.position[0], placement.position[2], -placement.position[1]),
        // Missing parent model data does not erase the source relationship.
        hasLod:placement.lodIndex>=0,
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
  const fades = entries.map(entry => placementFade(entry.object, parts[entry.part].definition?.flags, entry.interior,true));
  const frustum = new Frustum(), projectionView = new Matrix4(), cameraPosition = new Vector3();
  const update = (camera: PerspectiveCamera,lowLodScale=1) => {
    requireAsset(Number.isFinite(lowLodScale)&&lowLodScale>=0&&lowLodScale<=9,'Invalid low-LOD scale.');
    camera.updateWorldMatrix(true, false);
    cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView, camera.coordinateSystem, camera.reversedDepth);
    for (const index of order) {
      const entry = entries[index];
      const childRendered = entry.children.some(child => entries[child].covered);
      // Frustum reject before the sqrt + fade work: off-screen entries stay
      // unselected and only propagate child coverage.
      if(entry.root.visible && !childRendered && entry.sphere && !frustum.intersectsSphere(entry.sphere)){
        entry.selected=false;entry.covered=childRendered;entry.object.visible=false;
        continue;
      }
      const origin = entry.parent < 0 ? entry.origin : entries[entry.parent].origin;
      const baseRange = Math.min(entry.distance, camera.far + entry.radius);
      const width=distanceFadeWidth(baseRange,entry.distance,entry.hasLod);
      const bigRoot=!entry.hasLod&&(entry.children.length>0||isDistanceBigBuilding(entry.distance));
      const range=bigRoot?Math.fround(baseRange*lowLodScale):baseRange;
      const distance = origin.distanceTo(cameraPosition);
      const alpha = Number.isFinite(entry.distance) ? distanceFadeAlpha(distance, range, entry.distance, entry.hasLod,width) : distance < range ? 255 : 0;
      const fading = Number.isFinite(entry.distance) && distance >= range + 20 - width;
      entry.selected = entry.root.visible && alpha > 0 && !childRendered
        && (!entry.sphere || frustum.intersectsSphere(entry.sphere));
      entry.covered = entry.selected && !fading || childRendered;
      entry.object.visible = entry.selected;
      if (entry.selected) { fades[index].setAlpha(alpha, fading); fades[index].setDistance(distance); }
    }
  };
  return { update, dispose: () => fades.forEach(fade => fade.dispose()), get count() { return entries.reduce((n, e) => n + Number(e.root.visible && e.object.visible), 0); },
    models: () => parts.flatMap((part, i) => entries.some(e => e.part === i && e.root.visible && e.object.visible) ? [part.name] : []) };
}
