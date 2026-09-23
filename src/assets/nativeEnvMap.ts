import type {Material,Texture} from 'three';
/** RpMatFX environment mapping, PC style (librw gl3matfx.cpp / matfx_env shaders): the env texture is sampled
 * where the view-space normal points, uv = (0.5 + 0.5·n.x, 0.5 − 0.5·n.y), and added to the lit texel scaled by the
 * effect's coefficient (envMapApplyLight off, a white env colour). Vehicle bodies (vehicleenvmap128) and some
 * building glass carry it. */
export interface NativeEnvMap {texture:string;coefficient:number;fbAlpha:boolean}
/** Each env-mapped material's live coefficient, which a scorched vehicle's pipeline turns off. */
export const nativeEnvCoefficients=new WeakMap<Material,{value:number;base:number}>();
export function nativeEnvMap<T extends Material>(material:T,map:Texture,coefficient:number,fbAlpha=false):T{
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 // matfx_env.frag: fba = max(texel alpha, disableFBA), disableFBA being 1 unless the effect uses framebuffer alpha.
 const uniforms={nativeEnvMap:{value:map},nativeEnvCoefficient:{value:coefficient},nativeEnvDisableFba:{value:fbAlpha?0:1}};
 material.userData.nativeEnv={map,coefficient,fbAlpha};
 nativeEnvCoefficients.set(material,Object.assign(uniforms.nativeEnvCoefficient,{base:coefficient}));
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vNativeEnvUv;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\n{ vec3 nativeEnvNormal = normalize( normalMatrix * normal ); vNativeEnvUv = vec2( 0.5 + 0.5 * nativeEnvNormal.x, 0.5 - 0.5 * nativeEnvNormal.y ); }');
  // pass2 fogs to black while the texel fogs to the fog colour, so the reflection is added after the fog, faded by it.
  shader.fragmentShader='uniform sampler2D nativeEnvMap; uniform float nativeEnvCoefficient; uniform float nativeEnvDisableFba; varying vec2 vNativeEnvUv;\n'+shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\n{ float nativeEnvFog = 1.0;\n#ifdef USE_FOG\n nativeEnvFog = 1.0 - fogFactor;\n#endif\n gl_FragColor.rgb += texture2D( nativeEnvMap, vNativeEnvUv ).rgb * nativeEnvCoefficient * max( diffuseColor.a, nativeEnvDisableFba ) * nativeEnvFog; }');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-env-v1`;};
 return material;
}
