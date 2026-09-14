import type {Material} from 'three';
/** Native raster arithmetic already produces display-channel values. Keep raw
 * texture × prelight × material modulation through framebuffer blending, rather
 * than applying Three's additional linear-to-sRGB transfer. Fog follows this
 * stage and Three supplies its uniform in the framebuffer's output color space.
 * Sky/water/sprite adapters have their own color handling and do not use this. */
export function nativeRasterOutput<T extends Material>(material:T):T{
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.toneMapped=false;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','// Native raster output is already in display-channel space.');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-raster-output-v1`;};
 return material;
}
