import RAPIER from '@dimforge/rapier3d-compat';
import type {NativeCollisionSource} from './nativeCollision';
import {requireAsset} from '../assets/binary';

export interface NativeWheelSurface {material:number;light:number;faceIndex?:number}
/** Rapier encodes back faces as triangle index + triangle count. Mesh installation
 * must preserve source triangle order (no deletion/reordering flags). */
export function nativeCollisionSurface(source:NativeCollisionSource,hit?:Pick<RAPIER.RayIntersection,'featureType'|'featureId'>):NativeWheelSurface|undefined{
  if(source.kind!=='mesh')return {material:source.surface.material,light:source.surface.light};
  const count=source.mesh.indices.length/3,id=hit?.featureId;
  requireAsset(Number.isInteger(count)&&source.mesh.materials.length===count&&source.mesh.lights.length===count,'Invalid collision face metadata.');
  if(hit?.featureType!==RAPIER.FeatureType.Face||id===undefined||!Number.isInteger(id)||id<0||id>=2*count)return;
  const faceIndex=id>=count?id-count:id;
  return {material:source.mesh.materials[faceIndex],light:source.mesh.lights[faceIndex],faceIndex};
}

/** Refresh wheel raycasts first. Rapier exposes the ground collider but not its
 * triangle ID, so repeat only that collider's ray and verify the original hit.
 * Call before moving either body; missing or mismatched mesh hits remain unresolved. */
export function sampleNativeWheelSurface(controller:RAPIER.DynamicRayCastVehicleController,index:number,sources:ReadonlyMap<number,NativeCollisionSource>):NativeWheelSurface|undefined{
  requireAsset(Number.isInteger(index)&&index>=0&&index<controller.numWheels(),'Invalid wheel surface index.');
  if(!controller.wheelIsInContact(index))return;
  const ground=controller.wheelGroundObject(index);if(!ground)return;
  const source=sources.get(ground.handle);if(!source)return;
  if(source.kind!=='mesh')return nativeCollisionSurface(source);
  const origin=controller.wheelHardPoint(index),point=controller.wheelContactPoint(index);if(!origin||!point)return;
  const delta={x:point.x-origin.x,y:point.y-origin.y,z:point.z-origin.z};
  const distance=Math.hypot(delta.x,delta.y,delta.z);if(!Number.isFinite(distance)||distance<=1e-6)return;
  const tolerance=Math.max(1e-4,distance*1e-5);
  const ray=new RAPIER.Ray(origin,{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance});
  const hit=ground.castRayAndGetNormal(ray,distance+tolerance,true);
  if(!hit||Math.abs(hit.timeOfImpact-distance)>tolerance)return;
  return nativeCollisionSurface(source,hit);
}
