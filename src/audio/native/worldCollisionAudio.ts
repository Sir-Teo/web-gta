import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import type {WorldCar} from '../../simulation/WorldCar';
import {nativeCollisionSurface} from '../../simulation/nativeWheelSurface';
import type {NativeCollisionSource} from '../../simulation/nativeCollision';
import type {NativeCollider} from './NativeCollisionAudio';
import {SURFACE} from './NativeCollisionAudio';
import type {NativeVec} from './NativeSound';
type V3={x:number;y:number;z:number};
const native=(v:V3):NativeVec=>({x:v.x,y:-v.z,z:v.y});
/** A car as CAECollisionAudioEntity sees it: SURFACE_CAR with move and turn speeds in native units per frame. */
export function carCollider(car:WorldCar):NativeCollider{
 const body=car.car.body,q=body.rotation(),v=body.linvel(),w=body.angvel(),up=new Vector3(0,1,0).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));
 return {key:car,surface:SURFACE.car,vehicle:{up:native(up),moveSpeed:native({x:v.x/50,y:v.y/50,z:v.z/50}),turnSpeed:native({x:w.x/50,y:w.y/50,z:w.z/50})}};
}
/** Collision surface of a fixed world collider at a contact: spheres and boxes carry it, mesh faces are found with a short ray along -normal. */
export function worldColliderSurface(collider:RAPIER.Collider,sources:ReadonlyMap<number,{source:NativeCollisionSource}>|undefined,point:V3,normal:V3,sparks:(material:number)=>boolean):NativeCollider|undefined{
 const record=sources?.get(collider.handle);if(!record)return;
 let hit:RAPIER.RayColliderIntersection|undefined;
 if(record.source.kind==='mesh'){const ray=new RAPIER.Ray({x:point.x+normal.x*.2,y:point.y+normal.y*.2,z:point.z+normal.z*.2},{x:-normal.x,y:-normal.y,z:-normal.z});const h=collider.castRayAndGetNormal(ray,.6,true);if(h)hit={collider,timeOfImpact:h.timeOfImpact,normal:h.normal,featureType:h.featureType,featureId:h.featureId} as RAPIER.RayColliderIntersection;}
 const surface=nativeCollisionSurface(record.source,hit);if(!surface)return;
 return {key:collider.handle,surface:surface.material,building:true,sparks:sparks(surface.material)};
}
