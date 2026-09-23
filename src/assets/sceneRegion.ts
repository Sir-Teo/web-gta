import {Box3,Vector3} from 'three';
import {placementMatrix} from './placement';
import type {ColModel} from './col';
import { requireAsset } from './binary';
import type { IplInstance } from './ipl';
import type { PlacementRef } from './scenePlacements';
export interface SceneRegion { x: number; y: number; radius: number; includeCollisionBounds?:boolean; lodRadius?:number;
  /** CGame::currArea to stream; 0, the outside world, when absent. */
  interior?:number; }
/** CEntity::IsInArea: an entity's own area, or AREA_CODE_13 which every area shows. */
export const inArea=(placementInterior:number,area:number)=>placementInterior===area||placementInterior===13;
/** A placement's collision bounds transformed to the world, as the renderer-space XZ rectangle a region test needs.
 * District placements are parsed once and shared by every window, so this is computed once per placement and bounds
 * (and again if the placement is moved). */
const footprints=new WeakMap<IplInstance,{bounds:ColModel['bounds'];pose:readonly number[];minX:number;minZ:number;maxX:number;maxZ:number}>();
function footprint(p:IplInstance,bounds:ColModel['bounds']){
  const pose=[...p.position,...p.rotation],cached=footprints.get(p);
  if(cached&&cached.bounds===bounds&&cached.pose.every((v,i)=>v===pose[i]))return cached;
  const box=new Box3(new Vector3(...bounds.min),new Vector3(...bounds.max)).applyMatrix4(placementMatrix(p));
  const out={bounds,pose,minX:box.min.x,minZ:box.min.z,maxX:box.max.x,maxZ:box.max.z};footprints.set(p,out);return out;
}
/** Select native XY origins and optional intersecting COL bounds in one area, retaining LOD ancestry. `byKey` is the
 * rows by `namespace:index` when the caller already holds it (readScenePlacements does). */
export function selectSceneRegion(rows: {placement:IplInstance;ref:PlacementRef}[], interior:number, region?:SceneRegion,boundsFor?:(placement:IplInstance)=>ColModel['bounds']|undefined,distantFor?:(placement:IplInstance)=>number|undefined,byKey?:ReadonlyMap<string,{placement:IplInstance;ref:PlacementRef}>): IplInstance[] {
  if (!region) return rows.map(row=>row.placement).filter(p=>inArea(p.interior,interior));
  requireAsset([region.x,region.y,region.radius].every(Number.isFinite) && Math.abs(region.x)<=1e7 && Math.abs(region.y)<=1e7 && region.radius>0 && region.radius<=1e7, 'Invalid scene region.');
  requireAsset(region.lodRadius===undefined||Number.isFinite(region.lodRadius)&&region.lodRadius>=region.radius&&region.lodRadius<=3000,'Invalid distant scene radius.');
  const key=(ref:{namespace:string;index:number})=>`${ref.namespace}:${ref.index}`;
  const lookup=byKey??new Map(rows.map(row=>[key(row.ref),row]));
  // Rows are tracked by identity: a key string per row of every district cost more than the test itself.
  const selected=new Set<{placement:IplInstance;ref:PlacementRef}>();
  for (const row of rows) {
    const p=row.placement;
    if(!inArea(p.interior,interior))continue;
    const distantRange=distantFor?.(p);
    const radius=region.lodRadius!==undefined&&distantRange!==undefined?Math.max(region.radius,Math.min(region.lodRadius,distantRange+region.radius*.4+40)):region.radius;
    const originInside=Math.hypot(p.position[0]-region.x,p.position[1]-region.y)<=radius;
    let overlaps=false;
    if(!originInside&&region.includeCollisionBounds){
      const bounds=boundsFor?.(p);
      if(bounds){
        const box=footprint(p,bounds);
        const x=Math.max(box.minX,Math.min(region.x,box.maxX)),z=Math.max(box.minZ,Math.min(-region.y,box.maxZ));
        overlaps=Math.hypot(x-region.x,z+region.y)<=radius;
      }
    }
    if(!originInside&&!overlaps)continue;
    let current:typeof row|undefined=row;
    while(current && inArea(current.placement.interior,interior) && !selected.has(current)) {
      selected.add(current);current=current.ref.lodTarget ? lookup.get(key(current.ref.lodTarget)) : undefined;
    }
  }
  return rows.filter(row=>selected.has(row)).map(row=>row.placement);
}
