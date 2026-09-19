import {requireAsset} from './binary';
import {decodeNamedTextures,type TextureDecodeCache} from './modelTextures';

/** CCoronas::Init resolves the shiny-star raster from the selected particle TXD.
 * No arbitrary texture fallback or independent mask is applied. */
export function decodeSunTexture(dictionary:Uint8Array,cache?:TextureDecodeCache) {
  const textures=decodeNamedTextures(['coronastar'],dictionary,cache);
  requireAsset(textures.length===1,'The selected particle dictionary has no coronastar texture.');
  return textures[0];
}

/** Other CCoronas rasters from the particle dictionary: the sun's sea reflection (`coronaheadlightline`). */
export const EXTRA_SKY_TEXTURES=['coronaheadlightline'] as const;
/** Optional low clouds, water, CClouds::Init's moving fog mask (`cloudmasked`), the light-pool shadow (`shad_exp`) and
 * the extra corona rasters share the particle dictionary; sun-only dictionaries remain valid. */
export function decodeSkyTextures(dictionary:Uint8Array,cache?:TextureDecodeCache) {
  const textures=decodeNamedTextures(['coronastar','cloud1','waterclear256','cloudmasked','shad_exp',...EXTRA_SKY_TEXTURES],dictionary,cache);
  const find=(name:string)=>textures.find(t=>t.name.toLowerCase()===name);
  const texture=find('coronastar');
  requireAsset(texture,'The selected particle dictionary has no coronastar texture.');
  return {texture,cloud:find('cloud1'),water:find('waterclear256'),fog:find('cloudmasked'),pool:find('shad_exp'),extras:EXTRA_SKY_TEXTURES.map(find).filter(t=>!!t)};
}
