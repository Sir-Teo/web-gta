import type {Material} from 'three';
/** Native GREATER alpha comparison; Three's standard alphaTest is >=. This also
 * discards zero-alpha fragments at reference zero when depth writes are enabled. */
export function nativeAlphaReference(material:Material,reference:number){
 material.alphaTest=reference/255;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  // In bytes, as the D3D ALPHAREF test compares them: a texel stored as the reference itself must fail, where the float
  // sampled from it can land a rounding step above the float reference and pass.
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',this.alphaTest>0?'if (floor(diffuseColor.a * 255.0 + 0.5) <= floor(alphaTest * 255.0 + 0.5)) discard;':'if (floor(diffuseColor.a * 255.0 + 0.5) <= 0.0) discard;');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-alpha-greater-${this.alphaTest>0?'reference':'zero'}`;};
}
