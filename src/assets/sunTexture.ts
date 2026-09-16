import {requireAsset} from './binary';
import {decodeNamedTextures,type TextureDecodeCache} from './modelTextures';

/** CCoronas::Init resolves the shiny-star raster from the selected particle TXD.
 * No arbitrary texture fallback or independent mask is applied. */
export function decodeSunTexture(dictionary:Uint8Array,cache?:TextureDecodeCache) {
  const textures=decodeNamedTextures(['coronastar'],dictionary,cache);
  requireAsset(textures.length===1,'The selected particle dictionary has no coronastar texture.');
  return textures[0];
}

/** Optional low clouds, water and CClouds::Init's moving fog mask (`cloudmasked`) share the particle dictionary; sun-only dictionaries remain valid. */
export function decodeSkyTextures(dictionary:Uint8Array,cache?:TextureDecodeCache) {
  const textures=decodeNamedTextures(['coronastar','cloud1','waterclear256','cloudmasked'],dictionary,cache);
  const texture=textures.find(t=>t.name.toLowerCase()==='coronastar');
  requireAsset(texture,'The selected particle dictionary has no coronastar texture.');
  return {texture,cloud:textures.find(t=>t.name.toLowerCase()==='cloud1'),water:textures.find(t=>t.name.toLowerCase()==='waterclear256'),fog:textures.find(t=>t.name.toLowerCase()==='cloudmasked')};
}
