import {requireAsset} from '../assets/binary';
import type {ModelMaterialBinding} from '../assets/ModelObjects';
import type {ModelTexture} from '../assets/modelTextures';
export type NativeCarLightSlot='leftFront'|'rightFront'|'leftRear'|'rightRear';
const markers:readonly [NativeCarLightSlot,readonly number[]][]=[
 ['leftFront',[255,175,0]],['rightFront',[0,255,200]],['leftRear',[185,255,0]],['rightRear',[255,60,0]],
];
/** Source SetupLightFlags / SetEditableMaterialsCB order. Alpha is ignored. */
export function nativeCarLightSlot(rgb:readonly number[]):NativeCarLightSlot|undefined{
 return markers.find(([,color])=>color.every((value,i)=>value===rgb[i]))?.[0];
}
/** Material slots from SetupLightFlags: accepted pedal braking enables rear lamps;
 * night lights enable fronts and rears. The off branch keeps the shared whitened RGB. */
/** `broken`: the damage manager's lights in eLights order (front left, front right, rear right, rear left); a smashed
 * lamp stays unlit (DoVehicleLights has a VEHICLE_LIGHTS_IGNORE_DAMAGE flag, so damage normally puts a lamp out). */
export interface CarLightState {brake:boolean;headlights:boolean;broken?:readonly boolean[]}
const LIGHT_INDEX:Record<NativeCarLightSlot,number>={leftFront:0,rightFront:1,rightRear:2,leftRear:3};
export interface CarLightTarget {binding:{material:{color:{setRGB(r:number,g:number,b:number):void}}};slot:NativeCarLightSlot|undefined;
 /** The lit-lamp texture, and the material's own map and surface to go back to (without them the lamp is tinted). */
 litMap?:unknown;unlit?:{map:unknown;ambient:number;diffuse:number}}
/** gLightSurfProps (0x8A645C): ambient 5, specular 0, diffuse 1 — a lit lamp glows past the scene's lighting. */
export const LIGHT_SURFACE={ambient:5,diffuse:1} as const;
export function setCarLightState(targets:readonly CarLightTarget[],state:CarLightState){
 for(const target of targets){
  const {binding,slot}=target;
  const lit=!!slot&&!state.broken?.[LIGHT_INDEX[slot]]&&((slot==='leftRear'||slot==='rightRear')?state.brake||state.headlights:state.headlights);
  // SetEditableMaterialsCB: a lit slot swaps its texture to vehiclelightson128 and takes gLightSurfProps.
  if(target.litMap&&target.unlit){
   const material=binding.material as unknown as {map:unknown;needsUpdate:boolean;userData:{nativeSurface?:{ambient:{value:number};diffuse:{value:number}}}},surface=material.userData.nativeSurface;
   const map=lit?target.litMap:target.unlit.map;if(material.map!==map)material.map=map;
   if(surface){surface.ambient.value=lit?LIGHT_SURFACE.ambient:target.unlit.ambient;surface.diffuse.value=lit?LIGHT_SURFACE.diffuse:target.unlit.diffuse;}
   binding.material.color.setRGB(1,1,1);continue;
  }
  if(slot&&state.broken?.[LIGHT_INDEX[slot]]){binding.material.color.setRGB(1,1,1);continue;}
  if(slot==='leftRear'||slot==='rightRear'){const c:readonly [number,number,number]=lit?[2.4,0.3,0.25]:[1,1,1];binding.material.color.setRGB(...c);}
  else if(slot==='leftFront'||slot==='rightFront'){const c:readonly [number,number,number]=state.headlights?[1.7,1.7,1.6]:[1,1,1];binding.material.color.setRGB(...c);}
 }
}
/** The native shared-light-texture branch always whitens RGB, even for unknown
 * light markers and when every light is off. Preserve alpha and the source data. */
export function bindNativeCarLightMaterials(bindings:readonly ModelMaterialBinding[],texture:ModelTexture,litMap?:unknown){
 requireAsset(texture,'Resolved vehicle light texture is required.');
 const targets:(CarLightTarget&{binding:ModelMaterialBinding})[]=bindings.filter(binding=>binding.texture===texture).map(binding=>{
  const surface=binding.material.userData.nativeSurface as {ambient:{value:number};diffuse:{value:number}}|undefined;
  return {binding,slot:nativeCarLightSlot(binding.source.color),litMap,unlit:litMap&&surface?{map:binding.material.map,ambient:surface.ambient.value,diffuse:surface.diffuse.value}:undefined};
 });
 for(const {binding} of targets){binding.material.color.setRGB(1,1,1);binding.material.userData.nativeFadeColor=[1,1,1];}
 return targets;
}
