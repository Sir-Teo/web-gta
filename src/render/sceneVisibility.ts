import { Box3, Frustum, Matrix4, Sphere, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { ScenePart } from '../assets/scene';
import { planSceneCollision, isDistanceBigBuilding } from '../assets/sceneCollision';
import { requireAsset } from '../assets/binary';
import { placementMatrix } from '../assets/placement';
import { placementFade, persistentNormalMaterials, type SharedNormalMaterials } from './placementFade';
import { distanceFadeAlpha, distanceFadeWidth } from './distanceFade';
import { lodDistMultiplier } from './lodDistance';

/** Loaded-scene distance fading and sphere-frustum selection. Source streaming/occlusion remain separate. */
/** COcclusion for the visibility pass: CRenderer::SetupEntityVisibility culls an on-screen entity IsEntityOccluded says
 * stands behind an active occluder (native axes: x, y north, z up). */
export interface SceneOcclusion {entityOccluded(center:readonly [number,number,number],radius:number,box:{min:readonly [number,number,number];max:readonly [number,number,number];toWorld:(p:readonly [number,number,number])=>readonly [number,number,number]}):boolean;readonly active:readonly unknown[];}
export function sceneVisibility(parts: ScenePart[], roots: Object3D[], occlusion?: SceneOcclusion) {
  const stats={occluded:0};
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
      // The native bounding box and modelling matrix for CEntity::IsEntityOccluded (a sphere box without collision bounds).
      const matrix=placementMatrix(placement),boxMin:[number,number,number]=bounds?.min?[bounds.min[0],bounds.min[1],bounds.min[2]]:[-(sphere?.radius??0),-(sphere?.radius??0),-(sphere?.radius??0)],boxMax:[number,number,number]=bounds?.max?[bounds.max[0],bounds.max[1],bounds.max[2]]:[sphere?.radius??0,sphere?.radius??0,sphere?.radius??0];
      const occluderBox={min:boxMin,max:boxMax,toWorld:(p:readonly [number,number,number])=>{const e=matrix.elements,x=e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12],y=e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13],z=e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14];return [x,-z,y] as const;}};
      return {
        object, root: roots[partIndex], part: partIndex, sphere, interior: placement.interior, occluderBox,
        origin: new Vector3(placement.position[0], placement.position[2], -placement.position[1]),
        // Missing parent model data does not erase the source relationship.
        hasLod:placement.lodIndex>=0,
        /** CFileObjectInstance's m_bTunnel (0x800) and m_bTunnelTransition (0x1000). */
        tunnel:(placement.instanceType&0x800)!==0,tunnelTransition:(placement.instanceType&0x1000)!==0,
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
  // One set of flag-dependent material copies per model part and interior, shared by its placements and kept across
  // windows with the model's source (persistentNormalMaterials). Tag models (flag 0x100000) keep per-placement
  // copies: CTagManager sets each tag's own alpha on its second material.
  const sharedNormals = new Map<string, SharedNormalMaterials>();
  const fades = entries.map(entry => {
    const flags = parts[entry.part].definition?.flags ?? 0;
    let shared: SharedNormalMaterials | undefined;
    if (!(flags & 0x100000)) { const key = `${entry.part}:${entry.interior}`; shared = sharedNormals.get(key); if (!shared) { shared = persistentNormalMaterials(flags, entry.interior); sharedNormals.set(key, shared); } }
    return placementFade(entry.object, flags, entry.interior, true, shared);
  });
  // Models with 2d effect lights (ProcessLightsForEntity), by part.
  let litParts: boolean[] = [], lit: number[] = [];
  /** Recount after 2d effects arrive for models that were installed without them. */
  const refreshLit = () => {
    litParts = parts.map(part => !!part.model?.geometries.some(g => g.effects?.some(e => e.light || e.type === 4)));
    lit = entries.flatMap((entry, index) => litParts[entry.part] ? [index] : []);
  };
  refreshLit();
  const frustum = new Frustum(), projectionView = new Matrix4(), cameraPosition = new Vector3();
  /** CBaseModelInfo::m_nAlpha per part: a model streamed in starts at 0 and gains 16 a game frame while drawn
   * (IncreaseAlpha), snapping to 255 when none of it is on screen; an entity's fade alpha is it times the distance
   * fade, and until it reaches 255 the model counts as fading, so its LOD keeps drawing under it. */
  const partAlpha: number[] = parts.map(() => 255);
  const partRendered: boolean[] = parts.map(() => false);
  /** Parts CRenderer::PreRender reaches after the last update: drawn, or an off-screen lit placement in range (the
   * invisible list holds entities with pre-render effects). CEntity::PreRender runs a model's per-frame work for them. */
  const partPreRendered: boolean[] = parts.map(() => false);
  const update = (camera: PerspectiveCamera,lowLodScale=1,tunnels:{tunnels:boolean;outside:boolean}={tunnels:false,outside:true},frames=1) => {
    partRendered.fill(false);partPreRendered.fill(false);
    requireAsset(Number.isFinite(lowLodScale)&&lowLodScale>=0&&lowLodScale<=9,'Invalid low-LOD scale.');
    camera.updateWorldMatrix(true, false);
    cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView, camera.coordinateSystem, camera.reversedDepth);
    stats.occluded=0;
    // TheCamera.m_fLODDistMultiplier: the draw distance setting's share.
    const lodMultiplier=lodDistMultiplier();
    for (const index of order) {
      const entry = entries[index];
      const childRendered = entry.children.some(child => entries[child].covered);
      // Frustum reject before the sqrt + fade work: off-screen entries stay
      // unselected and only propagate child coverage.
      if(entry.removed){entry.selected=false;entry.covered=childRendered;entry.object.visible=false;entry.inRange=false;continue;}
      // CRenderer::SetupMapEntityVisibility: outside a tunnel zone tunnel entities are invisible, inside one the
      // outside world is, and tunnel-transition entities always pass.
      if(!entry.tunnelTransition&&(!tunnels.tunnels&&entry.tunnel||!tunnels.outside&&!entry.tunnel)){entry.selected=false;entry.covered=childRendered;entry.object.visible=false;entry.inRange=false;continue;}
      const measure = () => {
        const origin = entry.parent < 0 ? entry.origin : entries[entry.parent].origin;
        const baseRange = Math.min(entry.distance * lodMultiplier, camera.far + entry.radius);
        const width=distanceFadeWidth(baseRange,entry.distance,entry.hasLod);
        const bigRoot=!entry.hasLod&&(entry.children.length>0||isDistanceBigBuilding(entry.distance));
        const range=bigRoot?Math.fround(baseRange*lowLodScale):baseRange;
        const distance = origin.distanceTo(cameraPosition);
        const alpha = Number.isFinite(entry.distance) ? distanceFadeAlpha(distance, range, entry.distance, entry.hasLod,width) : distance < range ? 255 : 0;
        return {range,distance,alpha,width};
      };
      if(entry.root.visible && !childRendered && entry.sphere && !frustum.intersectsSphere(entry.sphere)){
        entry.selected=false;entry.covered=childRendered;entry.object.visible=false;
        if(litParts[entry.part]&&(entry.inRange=measure().alpha>0))partPreRendered[entry.part]=true;
        continue;
      }
      // CRenderer::SetupEntityVisibility: an on-screen entity behind an active occluder is culled like one off screen.
      if(occlusion&&occlusion.active.length&&entry.root.visible&&!childRendered&&entry.sphere&&occlusion.entityOccluded([entry.sphere.center.x,-entry.sphere.center.z,entry.sphere.center.y],entry.radius,entry.occluderBox)){
        stats.occluded++;entry.selected=false;entry.covered=childRendered;entry.object.visible=false;
        if(litParts[entry.part]&&(entry.inRange=measure().alpha>0))partPreRendered[entry.part]=true;
        continue;
      }
      const {range,distance,alpha:distanceAlpha,width} = measure();
      entry.inRange = entry.root.visible && distanceAlpha > 0 && !childRendered;
      const modelAlpha = partAlpha[entry.part], alpha = modelAlpha < 255 ? Math.trunc(distanceAlpha * modelAlpha / 255) : distanceAlpha;
      const fading = Number.isFinite(entry.distance) && distance >= range + 20 - width || modelAlpha < 255;
      entry.selected = entry.root.visible && distanceAlpha > 0 && !childRendered
        && (!entry.sphere || frustum.intersectsSphere(entry.sphere));
      entry.covered = entry.selected && !fading || childRendered;
      entry.object.visible = entry.selected;
      if (entry.selected) { partRendered[entry.part] = partPreRendered[entry.part] = true; fades[index].setAlpha(alpha, fading); fades[index].setDistance(distance); }
    }
    for (let part = 0; part < partAlpha.length; part++) if (partAlpha[part] < 255) partAlpha[part] = partRendered[part] ? Math.min(255, partAlpha[part] + 16 * frames) : 255;
  };
  const remove=(part:number,placement:number)=>{const entry=entries[offsets[part]+placement];if(!entry||entry.part!==part)return false;entry.removed=true;entry.object.visible=false;return true;};
  /** A placement hidden by `remove` drawn again (bIsVisible back on); the next update decides whether it shows. */
  const restore=(part:number,placement:number)=>{const entry=entries[offsets[part]+placement];if(!entry||entry.part!==part)return false;entry.removed=false;return true;};
  /** Rigid motion of an uprooted prop: its visual, culling sphere and fade origin follow `matrix`. */
  const homes=new Map<number,{matrix:Matrix4;inverse:Matrix4;sphere?:Sphere;origin:Vector3}>(),motion=new Matrix4();
  const move=(part:number,placement:number,matrix:Matrix4)=>{
    const index=offsets[part]+placement,entry=entries[index];if(!entry||entry.part!==part)return false;
    let home=homes.get(index);
    if(!home){home={matrix:entry.object.matrix.clone(),inverse:entry.object.matrix.clone().invert(),sphere:entry.sphere?.clone(),origin:entry.origin.clone()};homes.set(index,home);}
    motion.multiplyMatrices(matrix,home.inverse);
    entry.object.matrix.copy(matrix);entry.object.updateMatrixWorld(true);
    if(entry.sphere&&home.sphere)entry.sphere.center.copy(home.sphere.center).applyMatrix4(motion);
    entry.origin.copy(home.origin).applyMatrix4(motion);
    return true;
  };
  /** The lit entries in range after the last update, as part and placement indices. */
  const litInRange = () => lit.filter(index => entries[index].inRange).map(index => ({ index, part: entries[index].part, placement: index - offsets[entries[index].part], matrix: entries[index].object.matrix }));
  /** A placement's material-slot alpha (see placementFade.setMaterialAlpha). */
  const setMaterialAlpha=(part:number,placement:number,slot:number,alpha:number)=>{const i=offsets[part]+placement;if(entries[i]?.part===part)fades[i].setMaterialAlpha(slot,alpha);};
  return { partAlpha, partPreRendered, update, remove, restore, move, setMaterialAlpha, litInRange, refreshLit, stats, dispose: () => { fades.forEach(fade => fade.dispose()); sharedNormals.clear(); }, get count() { return entries.reduce((n, e) => n + Number(e.root.visible && e.object.visible), 0); },
    models: () => parts.flatMap((part, i) => entries.some(e => e.part === i && e.root.visible && e.object.visible) ? [part.name] : []),
    /** Dev probe: placements within `radius` of a renderer-space point, with their visibility and LOD state. */
    near: (x: number, z: number, radius: number) => entries.flatMap((e, i) => { const d = Math.hypot(e.origin.x - x, e.origin.z - z); return d <= radius ? [{ name: parts[e.part].name, distance: +d.toFixed(1), visible: e.root.visible && e.object.visible, selected: e.selected, covered: e.covered, hasLod: e.hasLod, parent: e.parent >= 0 ? parts[entries[e.parent].part].name : null, children: e.children.length, drawDistance: e.distance, y: +e.origin.y.toFixed(1) }] : []; }) };
}
