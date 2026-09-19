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
/** Select native XY origins and optional intersecting COL bounds in one area, retaining LOD ancestry. */
export function selectSceneRegion(rows: {placement:IplInstance;ref:PlacementRef}[], interior:number, region?:SceneRegion,boundsFor?:(placement:IplInstance)=>ColModel['bounds']|undefined,distantFor?:(placement:IplInstance)=>number|undefined): IplInstance[] {
  if (!region) return rows.map(row=>row.placement).filter(p=>inArea(p.interior,interior));
  requireAsset([region.x,region.y,region.radius].every(Number.isFinite) && Math.abs(region.x)<=1e7 && Math.abs(region.y)<=1e7 && region.radius>0 && region.radius<=1e7, 'Invalid scene region.');
  requireAsset(region.lodRadius===undefined||Number.isFinite(region.lodRadius)&&region.lodRadius>=region.radius&&region.lodRadius<=3000,'Invalid distant scene radius.');
  const key=(ref:{namespace:string;index:number})=>`${ref.namespace}:${ref.index}`;
  const byKey=new Map(rows.map(row=>[key(row.ref),row])), selected=new Set<string>();
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
        const box=new Box3(new Vector3(...bounds.min),new Vector3(...bounds.max)).applyMatrix4(placementMatrix(p));
        const x=Math.max(box.min.x,Math.min(region.x,box.max.x)),z=Math.max(box.min.z,Math.min(-region.y,box.max.z));
        overlaps=Math.hypot(x-region.x,z+region.y)<=radius;
      }
    }
    if(!originInside&&!overlaps)continue;
    let current:typeof row|undefined=row;
    while(current && inArea(current.placement.interior,interior) && !selected.has(key(current.ref))) {
      selected.add(key(current.ref));current=current.ref.lodTarget ? byKey.get(key(current.ref.lodTarget)) : undefined;
    }
  }
  return rows.filter(row=>selected.has(key(row.ref))).map(row=>row.placement);
}
