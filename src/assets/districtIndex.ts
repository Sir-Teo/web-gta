import {Box3,Vector3} from 'three';
import {requireAsset} from './binary';
import type {ColModel} from './col';
import type {IplInstance} from './ipl';
import {placementMatrix} from './placement';
import type {SceneRegion} from './sceneRegion';

export interface DistrictIndexSource {id:string;placements:readonly IplInstance[];boundsFor?:(placement:IplInstance)=>ColModel['bounds']|undefined;}
export interface IndexedDistrict {
 id:string;exteriorPlacements:number;collisionBounds:number;
 /** Per row: origin X/Y, world native XY minimum/maximum. Double precision
  * preserves the same boundary decisions as selectSceneRegion's transforms. */
 rectangles:Float64Array;hasCollisionBounds:Uint8Array;
}
/** Build once from text and binary district placements, then reuse for moving
 * region requests. This is source discovery, not loaded-entity ownership. */
export function buildDistrictIndex(sources:readonly DistrictIndexSource[]):IndexedDistrict[]{
 requireAsset(sources.length<=100,'District index exceeds the source limit.');
 const ids=new Set<string>();let total=0;
 return sources.map(source=>{
  const id=source.id.toLowerCase();requireAsset(!!id&&!ids.has(id),'Duplicate or empty district index source.');ids.add(id);
  total+=source.placements.length;requireAsset(total<=250000,'District index exceeds the placement limit.');
  const placements=source.placements.filter(p=>p.interior===0),rectangles=new Float64Array(placements.length*6),hasCollisionBounds=new Uint8Array(placements.length);let collisionBounds=0;
  placements.forEach((p,i)=>{
   requireAsset(p.position.every(Number.isFinite),'Invalid district placement position.');
   const [x,y]=p.position,bounds=source.boundsFor?.(p);
   if(bounds){
    const box=new Box3(new Vector3(...bounds.min),new Vector3(...bounds.max)).applyMatrix4(placementMatrix(p));
    requireAsset(!box.isEmpty()&&[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),'Invalid district collision bounds.');
    rectangles.set([x,y,box.min.x,-box.max.z,box.max.x,-box.min.z],i*6);hasCollisionBounds[i]=1;collisionBounds++;
   }else rectangles.set([x,y,x,y,x,y],i*6);
  });
  return {id,exteriorPlacements:placements.length,collisionBounds,rectangles,hasCollisionBounds};
 });
}
/** Narrow-phase circle/AABB tests match the existing region selector. A model
 * origin can be outside the circle while its transformed terrain still enters. */
export function queryDistrictIndex(index:readonly IndexedDistrict[],region:SceneRegion){
 requireAsset([region.x,region.y,region.radius].every(Number.isFinite)&&Math.abs(region.x)<=1e7&&Math.abs(region.y)<=1e7&&region.radius>0&&region.radius<=1e7,'Invalid district query region.');
 const matches:{id:string;placements:number;originMatches:number;boundsOnlyMatches:number}[]=[];
 for(const district of index){
  let originMatches=0,boundsOnlyMatches=0;
  for(let i=0;i<district.exteriorPlacements;i++){
   const a=district.rectangles,offset=i*6;
   if(Math.hypot(a[offset]-region.x,a[offset+1]-region.y)<=region.radius){originMatches++;continue;}
   if(!region.includeCollisionBounds||!district.hasCollisionBounds[i])continue;
   const x=Math.max(a[offset+2],Math.min(region.x,a[offset+4])),y=Math.max(a[offset+3],Math.min(region.y,a[offset+5]));
   if(Math.hypot(x-region.x,y-region.y)<=region.radius)boundsOnlyMatches++;
  }
  if(originMatches||boundsOnlyMatches)matches.push({id:district.id,placements:originMatches+boundsOnlyMatches,originMatches,boundsOnlyMatches});
 }
 return matches;
}
