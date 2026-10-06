/** CVehicle's paintjobs (remaps), as gta-reversed and the iOS executable have them: CVehicleModelInfo::FindTextureCB
 * (0x4C7510) marks a model's remappable texture, CVehicle::SetRemap (0x6D0C00; iOS 0x1004763c4) picks one of the
 * model's remap dictionaries, CVehicle::PreRender loads it and SetEditableMaterialsCB (0x4C8220) draws it. */

/** FindTextureCB: a texture vehicle.txd does not hold, found in the model's own dictionary under a name beginning
 * "remap", is renamed '#…'; SetEditableMaterialsCB gives every material whose texture's name begins '#' the remap
 * texture while one is set. */
export function isRemapMaterial(textureName:string,dictionary:string|undefined){
 return dictionary!=='vehicle'&&textureName.toLowerCase().startsWith('remap');
}
/** GetFirstTexture (0x734940): the first texture RwTexDictionaryForAllTextures visits, the head of the dictionary's
 * list, at whose front RwTexDictionaryAddTexture links each texture as it is read: the last one in the file. (Every
 * paintjob dictionary holds just the one.) */
export function firstTextureOf<T>(textures:readonly T[]):T|undefined{return textures.at(-1);}
/** CVehicle::SetRemap: an index past the model's remaps (m_anRemapTxds[index] is -1) clears it as -1 does. */
export function remapName(remaps:readonly string[],index:number){return index>=0?remaps[index]:undefined;}
/** CVehicle::PreRender once the remap dictionary is loaded: the primary colour becomes 1 (white), so the paintjob is
 * drawn unmodulated, unless bDontSetColourWhenRemapping. The other three are kept. */
export function remapColours(colours:readonly number[],dontSetColour=false):number[]{
 return dontSetColour?[...colours]:[1,colours[1],colours[2],colours[3]];
}
/** CStoredCar::StoreCar's m_nPaintjob: GetRemapIndex as an unsigned byte, 255 for none; RestoreCar hands it back to
 * SetRemap sign-extended (iOS 0x1001b8438), so 255 clears it. */
export const packStoredPaintjob=(index:number)=>index<0?255:index&255;
export const unpackStoredPaintjob=(byte:number)=>byte>=128?byte-256:byte;
