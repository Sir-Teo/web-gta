import { Box3, Frustum, Matrix4, Sphere, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { ScenePart } from '../assets/scene';
import { planSceneCollision, isDistanceBigBuilding } from '../assets/sceneCollision';
import { requireAsset } from '../assets/binary';
import { placementMatrix } from '../assets/placement';
import { placementFade, type SharedNormalMaterials } from './placementFade';
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
        /** Chosen by distance and LOD, whether or not in the frustum: CRenderer's visible and in-range lists that
         * CEntity::PreRender runs over. Kept for entries whose model has 2d effect lights. */
        inRange: false,
        /** A placement smashed or broken in play stays hidden until the region reloads. */
        removed: false,
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
  // One set of flag-dependent material copies per model part and interior, shared by its placements. Tag models
  // (flag 0x100000) keep per-placement copies: CTagManager sets each tag's own alpha on its second material.
  const sharedNormals = new Map<string, SharedNormalMaterials>();
  const fades = entries.map(entry => {
    const flags = parts[entry.part].definition?.flags ?? 0;
    let shared: SharedNormalMaterials | undefined;
    if (!(flags & 0x100000)) { const key = `${entry.part}:${entry.interior}`; shared = sharedNormals.get(key); if (!shared) { shared = new Map(); sharedNormals.set(key, shared); } }
    return placementFade(entry.object, flags, entry.interior, true, shared);
  });
  // Models with 2d effect lights (ProcessLightsForEntity), by part.
  let litParts: boolean[] = [], lit: number[] = [];
  /** Recount after 2d effects arrive for models that were installed without them. */
  const refreshLit = () => {
    litParts = parts.map(part => !!part.model?.geometries.some(g => g.effects?.some(e => e.light)));
    lit = entries.flatMap((entry, index) => litParts[entry.part] ? [index] : []);
  };
  refreshLit();
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
      if(entry.removed){entry.selected=false;entry.covered=childRendered;entry.object.visible=false;entry.inRange=false;continue;}
      const measure = () => {
        const origin = entry.parent < 0 ? entry.origin : entries[entry.parent].origin;
        const baseRange = Math.min(entry.distance, camera.far + entry.radius);
        const width=distanceFadeWidth(baseRange,entry.distance,entry.hasLod);
        const bigRoot=!entry.hasLod&&(entry.children.length>0||isDistanceBigBuilding(entry.distance));
        const range=bigRoot?Math.fround(baseRange*lowLodScale):baseRange;
        const distance = origin.distanceTo(cameraPosition);
        const alpha = Number.isFinite(entry.distance) ? distanceFadeAlpha(distance, range, entry.distance, entry.hasLod,width) : distance < range ? 255 : 0;
        return {range,distance,alpha,width};
      };
      if(entry.root.visible && !childRendered && entry.sphere && !frustum.intersectsSphere(entry.sphere)){
        entry.selected=false;entry.covered=childRendered;entry.object.visible=false;
        if(litParts[entry.part])entry.inRange=measure().alpha>0;
        continue;
      }
      const {range,distance,alpha,width} = measure();
      entry.inRange = entry.root.visible && alpha > 0 && !childRendered;
      const fading = Number.isFinite(entry.distance) && distance >= range + 20 - width;
      entry.selected = entry.root.visible && alpha > 0 && !childRendered
        && (!entry.sphere || frustum.intersectsSphere(entry.sphere));
      entry.covered = entry.selected && !fading || childRendered;
      entry.object.visible = entry.selected;
      if (entry.selected) { fades[index].setAlpha(alpha, fading); fades[index].setDistance(distance); }
    }
  };
  const remove=(part:number,placement:number)=>{const entry=entries[offsets[part]+placement];if(!entry||entry.part!==part)return false;entry.removed=true;entry.object.visible=false;return true;};
  /** Rigid motion of an uprooted prop: its visual, culling sphere and fade origin follow `matrix`. */
  const homes=new Map<number,{matrix:Matrix4;inverse:Matrix4;sphere?:Sphere;origin:Vector3}>(),motion=new Matrix4();
  const move=(part:number,placement:number,matrix:Matrix4)=>{
    const index=offsets[part]+placement,entry=entries[index];if(!entry||entry.part!==part)return false;
    let home=homes.get(index);
    if(!home){home={matrix:entry.object.matrix.clone(),inverse:entry.object.matrix.clone().invert(),sphere:entry.sphere?.clone(),origin:entry.origin.clone()};homes.set(index,home);}
    motion.multiplyMatrices(matrix,home.inverse);
    entry.object.matrix.copy(matrix);entry.object.matrixWorldNeedsUpdate=true;
    if(entry.sphere&&home.sphere)entry.sphere.center.copy(home.sphere.center).applyMatrix4(motion);
    entry.origin.copy(home.origin).applyMatrix4(motion);
    return true;
  };
  /** The lit entries in range after the last update, as part and placement indices. */
  const litInRange = () => lit.filter(index => entries[index].inRange).map(index => ({ index, part: entries[index].part, placement: index - offsets[entries[index].part], matrix: entries[index].object.matrix }));
  /** A placement's material-slot alpha (see placementFade.setMaterialAlpha). */
  const setMaterialAlpha=(part:number,placement:number,slot:number,alpha:number)=>{const i=offsets[part]+placement;if(entries[i]?.part===part)fades[i].setMaterialAlpha(slot,alpha);};
  return { update, remove, move, setMaterialAlpha, litInRange, refreshLit, dispose: () => { fades.forEach(fade => fade.dispose()); for (const shared of sharedNormals.values()) { shared.forEach(material => material.dispose()); shared.clear(); } sharedNormals.clear(); }, get count() { return entries.reduce((n, e) => n + Number(e.root.visible && e.object.visible), 0); },
    models: () => parts.flatMap((part, i) => entries.some(e => e.part === i && e.root.visible && e.object.visible) ? [part.name] : []) };
}
