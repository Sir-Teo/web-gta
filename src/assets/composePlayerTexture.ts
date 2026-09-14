import type {ModelTexture} from './modelTextures';
import {requireAsset} from './binary';
/** ClothesBuilder::CopyTexture / PlaceTextureOnTopOfTexture.
 * Layers replace the complete RGBA pixel whenever source alpha is nonzero;
 * this is deliberately not browser canvas source-over blending. */
export function composePlayerTexture(base:ModelTexture,layers:readonly ModelTexture[]):ModelTexture{
 const image=base.mips[0];
 requireAsset(image&&Number.isInteger(image.width)&&Number.isInteger(image.height)&&image.width>0&&image.height>0&&image.width*image.height<=4194304,'Invalid player texture dimensions.');
 const count=image.width*image.height*4;
 requireAsset(image.data.length===count,'Invalid player base pixel length.');
 requireAsset(layers.length<=32,'Too many player texture layers.');
 const data=image.data.slice();
 for(const layer of layers){
  const source=layer.mips[0];
  requireAsset(source&&source.width===image.width&&source.height===image.height&&source.data.length===count,'Player texture layers require matching dimensions and RGBA pixels.');
  for(let i=0;i<count;i+=4)if(source.data[i+3]!==0)data.set(source.data.subarray(i,i+4),i);
 }
 let hasAlpha=false;for(let i=3;i<count;i+=4)if(data[i]!==255){hasAlpha=true;break;}
 // Native copies only raster level zero and selects rwFILTERLINEAR (2).
 return {name:base.name,filter:2,addressU:1,addressV:1,hasAlpha,mips:[{width:image.width,height:image.height,data}]};
}
