import { requireAsset } from './binary';
import type { IplInstance } from './ipl';
import type { PlacementRef } from './scenePlacements';
export interface SceneRegion { x: number; y: number; radius: number; }
/** Select by native XY origin, then retain the complete same-interior LOD ancestry. */
export function selectSceneRegion(rows: {placement:IplInstance;ref:PlacementRef}[], interior:number, region?:SceneRegion): IplInstance[] {
  if (!region) return rows.map(row=>row.placement).filter(p=>p.interior===interior);
  requireAsset([region.x,region.y,region.radius].every(Number.isFinite) && Math.abs(region.x)<=1e7 && Math.abs(region.y)<=1e7 && region.radius>0 && region.radius<=1e7, 'Invalid scene region.');
  const key=(ref:{namespace:string;index:number})=>`${ref.namespace}:${ref.index}`;
  const byKey=new Map(rows.map(row=>[key(row.ref),row])), selected=new Set<string>();
  for (const row of rows) {
    const p=row.placement;
    if (p.interior!==interior || Math.hypot(p.position[0]-region.x,p.position[1]-region.y)>region.radius) continue;
    let current:typeof row|undefined=row;
    while(current && current.placement.interior===interior && !selected.has(key(current.ref))) {
      selected.add(key(current.ref));current=current.ref.lodTarget ? byKey.get(key(current.ref.lodTarget)) : undefined;
    }
  }
  return rows.filter(row=>selected.has(key(row.ref))).map(row=>row.placement);
}
