import RAPIER from '@dimforge/rapier3d-compat';
import type {ScenePart} from '../assets/scene';
import {planSceneCollision} from '../assets/sceneCollision';
import {installNativeCollision,colliderReach} from './nativeCollision';
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
type Position={x:number;y:number;z:number};
interface SupportQueries {
 ray:(ray:RAPIER.Ray,length:number)=>{timeOfImpact:number;normal:Position}|null;
 blocked:(shape:RAPIER.Shape,center:Position)=>boolean;
}
/** Shared acceptance policy for isolated-reference and direct-collider queries. */
function supportedPosition(queries:SupportQueries,center:Position,crouched:boolean){
 requireAsset([center.x,center.y,center.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid retained player position.');
 const halfHeight=crouched ? .35 : .6,radius=.3,foot={...center,y:center.y-halfHeight-radius};
 const hit=queries.ray(new RAPIER.Ray({x:foot.x,y:foot.y+.2,z:foot.z},{x:0,y:-1,z:0}),.4);
 requireAsset(!!hit&&hit.normal.y>=Math.SQRT1_2,'The new terrain does not support the current player position.');
 requireAsset(!queries.blocked(new RAPIER.Capsule(halfHeight,radius),center),'The new terrain obstructs the current player position.');
 return foot;
}
/** Reference path for callers with decoded parts but no installed candidate. */
export function assertNativeSceneSupport(parts:ScenePart[],center:Position,crouched:boolean){
 return queryDestination(parts,(world,handles,player)=>supportedPosition({
  ray:(ray,length)=>world.castRayAndGetNormal(ray,length,true,undefined,undefined,player,undefined,c=>handles.has(c.handle)),
  blocked:(shape,position)=>!!world.intersectionWithShape(position,{x:0,y:0,z:0,w:1},shape,undefined,undefined,player),
 },center,crouched));
}
/** Newly installed colliders have valid direct shape queries before the world's
 * broad phase sees them. Query only the candidate's handles; never step the live
 * world or include old-region/player colliders while validating replacement. */
export function assertInstalledSceneSupport(world:RAPIER.World,handles:Iterable<number>,center:Position,crouched:boolean){
 const colliders:RAPIER.Collider[]=[];let count=0;
 for(const handle of handles){
  requireAsset(++count<=20000,'Candidate support query exceeds the collider limit.');
  // The queries reach under 1.5 m from the capsule's centre; a collider whose bounds are further away cannot answer.
  const reach=colliderReach(world,handle);if(reach&&Math.hypot(reach[0]-center.x,reach[1]-center.y,reach[2]-center.z)>reach[3]+2)continue;
  const collider=world.getCollider(handle);requireAsset(collider,'Candidate collision is no longer available.');
  if(collider.isEnabled()&&collider.parent()?.isEnabled()!==false)colliders.push(collider);
 }
 return supportedPosition({
  ray:(ray,length)=>{
   let closest:ReturnType<SupportQueries['ray']>=null;
   for(const collider of colliders){const hit=collider.castRayAndGetNormal(ray,closest?.timeOfImpact??length,true);if(hit&&(!closest||hit.timeOfImpact<closest.timeOfImpact))closest=hit;}
   return closest;
  },
  blocked:(shape,position)=>colliders.some(collider=>collider.intersectsShape(shape,position,{x:0,y:0,z:0,w:1})),
 },center,crouched);
}
