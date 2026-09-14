import RAPIER from '@dimforge/rapier3d-compat';
import {nativeCollisionSurface} from './nativeWheelSurface';
import type {InstalledCollisionSource} from './nativeScene';
import type {Vec3} from '../core/math';
export {nativeContactBrightness} from '../assets/collisionLighting';
const f=Math.fround;
/** SetupLightingForEntity's contact/ambient factor, before generated point lights. */
export function nativeContactLightMultiplier(ambient:readonly number[],contact:number){
 if(ambient.length!==3||ambient.some(v=>!Number.isFinite(v)||v<0||v>1)||!Number.isFinite(contact)||contact<0||contact>1)throw new Error('Invalid native entity lighting inputs.');
 const mean=f(f(f(ambient[0]+ambient[2])+ambient[1])*f(1/3));
 return f(f(f(mean+contact)*f(.95))+f(.05));
}
/** A bounded support probe, not a replacement for native pedestrian contact selection. */
export function sampleNativeGroundLighting(world:RAPIER.World,foot:Vec3,player:RAPIER.Collider,sources:ReadonlyMap<number,InstalledCollisionSource>){
 if(![foot.x,foot.y,foot.z].every(Number.isFinite))throw new Error('Invalid ground lighting position.');
 const hit=world.castRayAndGetNormal(new RAPIER.Ray({x:foot.x,y:foot.y+.15,z:foot.z},{x:0,y:-1,z:0}),.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,player);
 if(!hit||hit.normal.y<.5)return;
 const record=sources.get(hit.collider.handle);if(!record)return;
 const surface=nativeCollisionSurface(record.source,hit);if(!surface)return;
 return {material:surface.material,light:surface.light,modelName:record.modelName,faceIndex:surface.faceIndex};
}
