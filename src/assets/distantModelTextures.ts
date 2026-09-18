import type {ModelTexture} from './modelTextures';
/** Use authored mip levels for distant-only models; never resample source pixels. */
export function distantModelTextures(textures:readonly ModelTexture[]):ModelTexture[]{
 return textures.map(texture=>{
  const first=texture.mips.findIndex(m=>m.width<=128&&m.height<=128);
  return first>0?{...texture,mips:texture.mips.slice(first),reconstructedMips:texture.reconstructedMips?.filter(i=>i>=first).map(i=>i-first),droppedMips:texture.droppedMips?.filter(i=>i>=first).map(i=>i-first)}:texture;
 });
}
