import type {Material,Texture} from 'three';
/** RpMatFX environment mapping, PC style (librw gl3matfx.cpp / matfx_env shaders): the env texture is sampled
 * where the view-space normal points, uv = (0.5 + 0.5·n.x, 0.5 − 0.5·n.y), and added to the lit texel scaled by the
 * effect's coefficient (envMapApplyLight off, a white env colour). Vehicle bodies (vehicleenvmap128) and some
 * building glass carry it. */
export interface NativeEnvMap {texture:string;coefficient:number;fbAlpha:boolean}
export function nativeEnvMap<T extends Material>(material:T,map:Texture,coefficient:number):T{
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 const uniforms={nativeEnvMap:{value:map},nativeEnvCoefficient:{value:coefficient}};
 material.userData.nativeEnv={map,coefficient};
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vNativeEnvUv;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\n{ vec3 nativeEnvNormal = normalize( normalMatrix * normal ); vNativeEnvUv = vec2( 0.5 + 0.5 * nativeEnvNormal.x, 0.5 - 0.5 * nativeEnvNormal.y ); }');
  shader.fragmentShader='uniform sampler2D nativeEnvMap; uniform float nativeEnvCoefficient; varying vec2 vNativeEnvUv;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight += texture2D( nativeEnvMap, vNativeEnvUv ).rgb * nativeEnvCoefficient;\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-env-v1`;};
 return material;
}
