import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {requireAsset} from '../assets/binary';
import type {NativeSuspensionLine} from './nativeSuspension';
import {colliderReach} from './nativeCollision';
import type {CarWheel} from './nativeDriveContacts';
/** Candidate-only direct queries work before the new terrain enters Rapier's
 * broad phase. An occupied car is supported at its wheels, not by a ped capsule. */
export function assertNativeVehicleTerrainSupport(world:RAPIER.World,handles:Iterable<number>,body:RAPIER.RigidBody,lines:Record<CarWheel,NativeSuspensionLine>){
 const colliders:RAPIER.Collider[]=[];let count=0;
 const p=body.translation();
 // The wheel rays stay within this distance of the body; a collider whose bounds are further away cannot answer them.
 const extent=Math.max(...Object.values(lines).map(line=>Math.hypot(line.start.x,line.start.y,line.start.z)+line.lineLength+.3))+2;
 for(const handle of handles){requireAsset(++count<=20000,'Vehicle terrain support exceeds the collider limit.');
  const reach=colliderReach(world,handle);if(reach&&Math.hypot(reach[0]-p.x,reach[1]-p.y,reach[2]-p.z)>reach[3]+extent)continue;
  const collider=world.getCollider(handle);requireAsset(collider,'Candidate vehicle collision is no longer available.');if(collider.isEnabled()&&collider.parent()?.isEnabled()!==false)colliders.push(collider);}
 const q=body.rotation(),rotation=new Quaternion(q.x,q.y,q.z,q.w),direction=new Vector3(0,-1,0).applyQuaternion(rotation),hits:number[]=[];
 for(const line of Object.values(lines)){
  const start=new Vector3(line.start.x,line.start.z,-line.start.y).applyQuaternion(rotation).add(new Vector3(p.x,p.y,p.z));
  const ray=new RAPIER.Ray(start,direction);let nearest=line.lineLength+.3,found=false;
  for(const collider of colliders){const hit=collider.castRayAndGetNormal(ray,nearest,true);if(hit&&hit.normal.y>.25){nearest=hit.timeOfImpact;found=true;}}
  if(found)hits.push(start.y+direction.y*nearest);
 }
 requireAsset(hits.length>0,'The new terrain does not support the occupied vehicle.');
 return {x:p.x,y:Math.max(...hits),z:p.z};
}
