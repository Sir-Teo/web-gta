import {requireAsset} from '../assets/binary';
import type {ModelMaterialBinding} from '../assets/ModelObjects';
import type {ModelTexture} from '../assets/modelTextures';
export type NativePaintRGB=readonly [number,number,number];
export type NativeCarColors=readonly [NativePaintRGB,NativePaintRGB,NativePaintRGB,NativePaintRGB];
const markers:readonly NativePaintRGB[]=[[60,255,0],[255,0,175],[0,255,255],[255,0,255]];
/** SetEditableMaterialsCB RGB markers; alpha never participates in lookup. */
export function nativeCarPaintSlot(color:readonly number[]):number|undefined {
 const slot=markers.findIndex(marker=>marker.every((value,i)=>value===color[i]));
 return slot<0?undefined:slot;
}
/** Instance-owned material colors. The resolved light texture's identity excludes
 * its materials from the source callback's paint branch. No palette or random
 * selection is invented: callers supply all four resolved byte RGB colors. */
export function bindNativeCarPaint(bindings:readonly ModelMaterialBinding[],lightTexture?:ModelTexture){
 const targets=bindings.flatMap(binding=>{
  if(!(binding.geometryFlags&64)||lightTexture&&binding.texture===lightTexture)return [];
  const slot=nativeCarPaintSlot(binding.source.color);return slot===undefined?[]:[{binding,slot}];
 });
 return {setColors(colors:NativeCarColors){
  requireAsset(colors.length===4&&[0,1,2,3].every(i=>colors[i]?.length===3&&[0,1,2].every(j=>{const v=colors[i][j];return Number.isInteger(v)&&v>=0&&v<=255;})),'Car paint requires four byte RGB colors.');
  for(const {binding,slot} of targets){
   const rgb=colors[slot].map(v=>v/255);
   binding.material.color.setRGB(rgb[0],rgb[1],rgb[2]);
   binding.material.userData.nativeFadeColor=rgb;
  }
 },count:targets.length};
}
