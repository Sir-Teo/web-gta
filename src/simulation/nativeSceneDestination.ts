import RAPIER from '@dimforge/rapier3d-compat';
import type {ScenePart} from '../assets/scene';
import {planSceneCollision} from '../assets/sceneCollision';
import {installNativeCollision} from './nativeCollision';
import {importedSpawn} from './importedSpawn';
/** Call after scene installation preflight, before retiring the old owner.
 * An isolated query world avoids stepping the live player or testing clearance
 * against the previous region's overlapping terrain. */
export function nativeSceneDestination(parts:ScenePart[],preferred?:{x:number;z:number}){
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const plan=planSceneCollision(parts),handles=new Set<number>();
  for(const [index,part] of parts.entries())if(part.collision)for(const placement of plan.placements[index]){
   const installed=installNativeCollision(world,part.collision,placement);
   for(const handle of installed.sources.keys())handles.add(handle);
  }
  const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3).setTranslation(1e8,1e8,1e8));
  world.step();return importedSpawn(world,parts,handles,player,preferred);
 }finally{world.free();}
}
