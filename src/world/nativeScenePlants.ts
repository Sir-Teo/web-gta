import type {ScenePart} from '../assets/scene';
import type {ColModel} from '../assets/col';
import type {SurfaceInfoRecord} from '../assets/surfaceInfo';
import {placedEntityKind,type ObjectDataRecord} from '../assets/objectData';
import {planSceneCollision} from '../assets/sceneCollision';
import {nativePlacementMatrix} from '../assets/placement';
import {requireAsset} from '../assets/binary';
import {nativeVegetationEligibility} from './nativeVegetation';
import type {NativePlantEntity} from './NativePlantEntityCache';

/** SetPlantFriendlyFlagInAtomicMI checks every COL triangle, including those
 * outside the current camera region and object-only procedural surfaces. */
export function nativePlantFriendly(collision:ColModel|undefined,info:ReadonlyMap<number,SurfaceInfoRecord>){
 return !!collision?.mesh.materials.some(surface=>{
  const flags=nativeVegetationEligibility(surface,info);return flags.plants||flags.objects;
 });
}

/** Adapt imported static scene content for vegetation. Result order is scene
 * order, not a reconstruction of original world insertion history. Requires
 * an explicit OBJECT.DAT index so unknown entity kinds cannot become buildings. */
export function nativeScenePlantEntities(parts:ScenePart[],info:ReadonlyMap<number,SurfaceInfoRecord>,objects:ReadonlyMap<string,ObjectDataRecord>,area:number){
 requireAsset(Number.isInteger(area)&&area>=0&&area<=255,'Invalid plant scene area.');
 const plan=planSceneCollision(parts),entities:NativePlantEntity[]=[],identities=new Set<string>();
 for(const [partIndex,part] of parts.entries()){
  if(part.definition?.section!=='objs'||placedEntityKind(part.name,objects)!=='building'||!nativePlantFriendly(part.collision,info))continue;
  for(const index of plan.indices[partIndex]){
   const placement=part.placements[index],ref=part.sourceRefs?.[index];
   requireAsset(!!ref?.sourceName,'Vegetation requires original placement source identities.');
   const identity=JSON.stringify([ref.sourceName.toLowerCase(),ref.index]);
   requireAsset(!identities.has(identity),'Duplicate native plant placement identity.');identities.add(identity);
   entities.push({identity,collision:part.collision!,matrix:nativePlacementMatrix(placement),inCurrentArea:placement.interior===area||placement.interior===13,procedural:false,atomic:true,plantFriendly:true,scanCurrent:false});
  }
 }
 return entities;
}
