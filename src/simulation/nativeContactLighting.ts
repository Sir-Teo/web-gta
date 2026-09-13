import RAPIER from '@dimforge/rapier3d-compat';
import {nativeCollisionSurface} from './nativeWheelSurface';
import type {InstalledCollisionSource} from './nativeScene';
import type {Vec3} from '../core/math';
const f=Math.fround;
/** tColLighting::GetCurrentLighting with its default scale of 0.5. */
export function nativeContactBrightness(light:number,night:number){
 if(!Number.isInteger(light)||light<0||light>255||!Number.isFinite(night)||night<0||night>1)throw new Error('Invalid native contact lighting.');
 const day=f(f((light&15)*.5)/15),dark=f(f((light>>>4)*.5)/15),blend=f(night);
 return f(f(day*f(1-blend))+f(dark*blend));
}
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
 return {light:surface.light,modelName:record.modelName,faceIndex:surface.faceIndex};
}
