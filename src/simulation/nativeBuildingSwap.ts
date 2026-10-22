import type {ScenePart} from '../assets/scene';
import {placedEntityKind,type ObjectDataRecord} from '../assets/objectData';
type Point={x:number;y:number;z:number};
export interface BuildingSwapCandidate {key:string;model:string;modelId:number;position:Point;format:'text'|'binary'}
export function buildingPlacementKey(part:ScenePart,index:number){const ref=part.sourceRefs?.[index];return ref?JSON.stringify([ref.sourceName.toLowerCase(),ref.format,ref.index]):undefined;}
/** CWorld::FindObjectsOfTypeInRange's building-only, 2D first-sixteen buffer, followed by the handler's 3D nearest.
 * Candidate iteration is the loaded placement order; native repeat-sector ordering remains an integration limit. */
export function closestBuildingForSwap(candidates:Iterable<BuildingSwapCandidate>,point:Point,radius:number,model:number|string){
 const f=Math.fround,r=f(radius),r2=f(r*r),x=f(point.x),y=f(point.y),z=f(point.z);let count=0,best:BuildingSwapCandidate|undefined,distance=f(r+r);
 for(const c of candidates){
  if(typeof model==='number'?c.modelId!==model:c.model.toLowerCase()!==model.toLowerCase())continue;
  const dx=f(f(c.position.x)-x),dy=f(f(c.position.y)-y),planar=f(f(dx*dx)+f(dy*dy));if(!(planar<r2))continue;
  if(count++>=16)break;
  const dz=f(f(c.position.z)-z),d=f(Math.sqrt(f(planar+f(dz*dz))));if(d<distance){best=c;distance=d;}
 }
 return best;
}
export function sceneBuildings(parts:readonly ScenePart[],definitions?:ReadonlyMap<string,ObjectDataRecord>):BuildingSwapCandidate[]{
 const out:BuildingSwapCandidate[]=[];
 for(const part of parts){if((part.nativeEntityKind??placedEntityKind(part.name,definitions))!=='building')continue;
  part.placements.forEach((p,i)=>{const key=buildingPlacementKey(part,i),ref=part.sourceRefs?.[i];if(key&&ref)out.push({key,model:part.name,modelId:p.modelId,position:{x:p.position[0],y:p.position[1],z:p.position[2]},format:ref.format});});
 }
 return out;
}
/** Split out each changed placement while preserving source/LOD identity and the modelling matrix.
 * Geometry and collision come from the replacement model; the entity remains a CBuilding. */
export function replaceSceneBuildingModels(parts:readonly ScenePart[],replacements:ReadonlyMap<string,ScenePart>):ScenePart[]{
 const out:ScenePart[]=[],changed:ScenePart[]=[];
 for(const part of parts){const keep:number[]=[];
  part.placements.forEach((p,i)=>{
   const key=buildingPlacementKey(part,i),target=key&&replacements.get(key);
   if(!target||target.name.toLowerCase()===part.name.toLowerCase()){keep.push(i);return;}
   changed.push({...target,resident:false,nativeEntityKind:'building',placements:[{...p,modelId:target.definition?.id??p.modelId,modelName:target.name}],sourceRefs:part.sourceRefs&&[part.sourceRefs[i]],sourceIndices:part.sourceIndices&&[part.sourceIndices[i]],placementFormat:part.placementFormat});
  });
  if(keep.length===part.placements.length)out.push(part);
  else if(keep.length)out.push({...part,placements:keep.map(i=>part.placements[i]),sourceRefs:part.sourceRefs&&keep.map(i=>part.sourceRefs![i]),sourceIndices:part.sourceIndices&&keep.map(i=>part.sourceIndices![i])});
 }
 return [...out,...changed];
}
/** A live model override is separate from the native 25-slot swap ledger used by undo/save.
 * Streamed binary IPL entities lose their live override when their placement leaves the loaded window. */
export class NativeBuildingSwaps {
 private live=new Map<string,{part:ScenePart;format:'text'|'binary'}>();
 private ledger=new Map<string,{original:string;current:string}>();
 stage(candidate:BuildingSwapCandidate,target:ScenePart){
  const oldLive=this.live.get(candidate.key),oldLedger=this.ledger.get(candidate.key),next={part:target,format:candidate.format};
  this.live.set(candidate.key,next);
  if(candidate.format==='text'){
   if(oldLedger){if(target.name.toLowerCase()===oldLedger.original)this.ledger.delete(candidate.key);else this.ledger.set(candidate.key,{...oldLedger,current:target.name.toLowerCase()});}
   else if(this.ledger.size<25)this.ledger.set(candidate.key,{original:candidate.model.toLowerCase(),current:target.name.toLowerCase()});
  }
  return ()=>{if(oldLive)this.live.set(candidate.key,oldLive);else this.live.delete(candidate.key);if(oldLedger)this.ledger.set(candidate.key,oldLedger);else this.ledger.delete(candidate.key);};
 }
 apply(parts:readonly ScenePart[]){
  return replaceSceneBuildingModels(parts,new Map([...this.live].map(([key,v])=>[key,v.part])));
 }
 /** Retire streamed entities only after a window commits, so a failed prebuild cannot undo a live swap. */
 windowInstalled(parts:readonly ScenePart[]){
  const present=new Set(parts.flatMap(p=>p.placements.map((_,i)=>buildingPlacementKey(p,i))));
  for(const [key,v] of this.live)if(v.format==='binary'&&!present.has(key))this.live.delete(key);
 }
 snapshot(){return {live:this.live.size,tracked:[...this.ledger].map(([key,v])=>({key,...v}))};}
}
