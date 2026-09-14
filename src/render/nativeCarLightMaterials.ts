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
/** The native shared-light-texture branch always whitens RGB, even for unknown
 * light markers and when every light is off. Preserve alpha and the source data.
 * Active-light texture/surface switching is a separate unfinished stage. */
export function bindNativeCarLightMaterials(bindings:readonly ModelMaterialBinding[],texture:ModelTexture){
 requireAsset(texture,'Resolved vehicle light texture is required.');
 const targets=bindings.filter(binding=>binding.texture===texture).map(binding=>({binding,slot:nativeCarLightSlot(binding.source.color)}));
 for(const {binding} of targets){binding.material.color.setRGB(1,1,1);binding.material.userData.nativeFadeColor=[1,1,1];}
 return targets;
}
