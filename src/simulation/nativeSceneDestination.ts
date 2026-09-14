import RAPIER from '@dimforge/rapier3d-compat';
import type {ScenePart} from '../assets/scene';
import {planSceneCollision} from '../assets/sceneCollision';
import {installNativeCollision} from './nativeCollision';
import {importedSpawn} from './importedSpawn';
import {requireAsset} from '../assets/binary';
/** Call after scene installation preflight, before retiring the old owner.
 * An isolated query world avoids stepping the live player or testing clearance
 * against the previous region's overlapping terrain. */
function queryDestination<T>(parts:ScenePart[],query:(world:RAPIER.World,handles:Set<number>,player:RAPIER.Collider)=>T):T{
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const plan=planSceneCollision(parts),handles=new Set<number>();
  for(const [index,part] of parts.entries())if(part.collision)for(const placement of plan.placements[index]){
   const installed=installNativeCollision(world,part.collision,placement);
   for(const handle of installed.sources.keys())handles.add(handle);
  }
  const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3).setTranslation(1e8,1e8,1e8));
  world.step();return query(world,handles,player);
 }finally{world.free();}
}
export function nativeSceneDestination(parts:ScenePart[],preferred?:{x:number;z:number}){
 return queryDestination(parts,(world,handles,player)=>importedSpawn(world,parts,handles,player,preferred));
}
/** Validate the live upright capsule without snapping, searching or changing pose.
 * Tolerances follow the character's 0.2 ground snap and 45-degree climb limit.
 * Call only for a grounded character, after installation limits have passed. */
export function assertNativeSceneSupport(parts:ScenePart[],center:{x:number;y:number;z:number},crouched:boolean){
 requireAsset([center.x,center.y,center.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid retained player position.');
 const halfHeight=crouched?.35:.6,radius=.3,foot={...center,y:center.y-halfHeight-radius};
 return queryDestination(parts,(world,handles,player)=>{
  const hit=world.castRayAndGetNormal(new RAPIER.Ray({x:foot.x,y:foot.y+.2,z:foot.z},{x:0,y:-1,z:0}),.4,true,undefined,undefined,player,undefined,c=>handles.has(c.handle));
  requireAsset(!!hit&&hit.normal.y>=Math.SQRT1_2,'The new terrain does not support the current player position.');
  const blocked=world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(halfHeight,radius),undefined,undefined,player);
  requireAsset(!blocked,'The new terrain obstructs the current player position.');
  return foot;
 });
}
