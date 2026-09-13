import {requireAsset} from './binary';
import {decodeNamedTextures,type TextureDecodeCache} from './modelTextures';

/** CCoronas::Init resolves the shiny-star raster from the selected particle TXD.
 * No arbitrary texture fallback or independent mask is applied. */
export function decodeSunTexture(dictionary:Uint8Array,cache?:TextureDecodeCache) {
  const textures=decodeNamedTextures(['coronastar'],dictionary,cache);
  requireAsset(textures.length===1,'The selected particle dictionary has no coronastar texture.');
  return textures[0];
}
