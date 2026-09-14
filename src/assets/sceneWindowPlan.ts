import {requireAsset} from './binary';
import type {ScenePart} from './scene';
import type {PlacementRef} from './scenePlacements';
import {planSceneCollision} from './sceneCollision';

export interface CatalogPlacement {key:string;part:number;placement:number;model:string;fingerprint:string;lodTargetKey?:string;unresolvedLodTarget:boolean;physical:boolean;}
export interface ScenePlacementCatalog {dataset:string;entries:ReadonlyMap<string,CatalogPlacement>;unresolvedLodTargets:number;}
const localKey=(ref:{namespace:string;index:number})=>`${ref.namespace}:${ref.index}`;
/** Dataset identifies one immutable selected-content session/version. Filenames
 * alone must not identify assets across different depots or modified sources. */
export function catalogScenePlacements(parts:ScenePart[],dataset:string):ScenePlacementCatalog {
 requireAsset(typeof dataset==='string'&&dataset.length>0&&dataset.length<=256,'Invalid scene dataset identity.');
 const collision=planSceneCollision(parts),stable=new Map<string,string>(),entries=new Map<string,CatalogPlacement>();
 const stableKey=(ref:PlacementRef)=>{
  requireAsset(typeof ref.sourceName==='string'&&ref.sourceName.trim().length>0&&ref.sourceName.length<=1024&&(ref.format==='text'||ref.format==='binary'),'Streaming catalog requires a valid placement source.');
  return JSON.stringify([dataset,ref.sourceName.toLowerCase(),ref.format,ref.index]);
 };
 for(const part of parts){
  requireAsset(!!part.sourceRefs,'Streaming catalog requires placement source references.');
  for(const ref of part.sourceRefs!)stable.set(localKey(ref),stableKey(ref));
 }
 let unresolvedLodTargets=0;
 parts.forEach((part,partIndex)=>{
  const physical=new Set(collision.placements[partIndex]);
  part.placements.forEach((placement,index)=>{
   const ref=part.sourceRefs![index],key=stable.get(localKey(ref))!;
   requireAsset(!entries.has(key),`Duplicate source placement identity: ${ref.sourceName} / ${ref.index}.`);
   const lodTargetKey=ref.lodTarget?stable.get(localKey(ref.lodTarget)):undefined,unresolvedLodTarget=!!ref.lodTarget&&!lodTargetKey;
   if(unresolvedLodTarget)unresolvedLodTargets++;
   const isPhysical=physical.has(placement)&&!!part.collision;
   // Snapshot values, not mutable object identity. Geometry/texture bytes belong
   // to the immutable dataset; changing those requires a new dataset identity.
   const fingerprint=JSON.stringify([part.name.toLowerCase(),placement,part.definition,part.timeCounterpart,part.visibilityBounds,isPhysical,!!part.collision,lodTargetKey]);
   entries.set(key,{key,part:partIndex,placement:index,model:part.name,fingerprint,lodTargetKey,unresolvedLodTarget,physical:isPhysical});
  });
 });
 return {dataset,entries,unresolvedLodTargets};
}
/** A reconciliation plan only: no renderer/physics resources are mutated here.
 * An unresolved LOD target prevents retention even when its local index agrees. */
export function planSceneWindow(previous:ScenePlacementCatalog,next:ScenePlacementCatalog){
 const retained:CatalogPlacement[]=[],added:CatalogPlacement[]=[],removed:CatalogPlacement[]=[],replaced:{previous:CatalogPlacement;next:CatalogPlacement}[]=[];
 for(const entry of next.entries.values()){
  const old=previous.entries.get(entry.key);
  if(!old)added.push(entry);
  else if(!old.unresolvedLodTarget&&!entry.unresolvedLodTarget&&old.fingerprint===entry.fingerprint)retained.push(entry);
  else replaced.push({previous:old,next:entry});
 }
 for(const entry of previous.entries.values())if(!next.entries.has(entry.key))removed.push(entry);
 return {retained,added,removed,replaced};
}
