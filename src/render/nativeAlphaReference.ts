import type {Material} from 'three';
/** Native GREATER alpha comparison; Three's standard alphaTest is >=. This also
 * discards zero-alpha fragments at reference zero when depth writes are enabled. */
export function nativeAlphaReference(material:Material,reference:number){
 material.alphaTest=reference/255;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',this.alphaTest>0?'if (diffuseColor.a <= alphaTest) discard;':'if (diffuseColor.a <= 0.0) discard;');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-alpha-greater-${this.alphaTest>0?'reference':'zero'}`;};
}
