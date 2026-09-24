import {RepeatWrapping,type Material,type Texture} from 'three';
/** RpMatFX environment mapping, PC style (librw gl3matfx.cpp / matfx_env shaders): the env texture is sampled
 * where the view-space normal points, uv = (0.5 + 0.5·n.x, 0.5 − 0.5·n.y), and added to the lit texel scaled by the
 * effect's coefficient (envMapApplyLight off, a white env colour). Vehicle bodies (vehicleenvmap128) and some
 * building glass carry it. A building-pipeline atomic reflects through CCustomBuildingPipeline instead (see
 * nativeBuildingEnvMap). */
export interface NativeEnvMap {texture:string;coefficient:number;fbAlpha:boolean}
/** Each env-mapped material's live coefficient, which a scorched vehicle's pipeline turns off. */
export const nativeEnvCoefficients=new WeakMap<Material,{value:number;base:number}>();
export function nativeEnvMap<T extends Material>(material:T,map:Texture,coefficient:number,fbAlpha=false,shininess=1):T{
 return envPass(material,map,coefficient,fbAlpha,'matfx',{map,coefficient,fbAlpha,shininess});
}
/** The source's env data the building pipeline's copy reads: SA's reflection-plugin shininess (1 without the plugin). */
export interface NativeEnvSource {map:Texture;coefficient:number;fbAlpha:boolean;shininess:number}
/** CCustomBuildingPipeline (0x5D7DB0, 0x5D77D0): a material with a MatFX env texture and a non-zero shininess
 * (MF_HAS_SHINE_CAM) multiply-adds the texture at a white TFACTOR, so at full strength whatever the MatFX coefficient,
 * the coordinates being the raw camera-space normal (TCI_CAMERASPACENORMAL, no transform: a face towards the camera
 * reads the texture's corner, and the normal's −1..1 wraps it twice) with the texture on wrap addressing. */
export function nativeBuildingEnvMap<T extends Material>(material:T,source:NativeEnvSource):T|undefined{
 if(source.shininess===0)return undefined;
 if(source.map.wrapS!==RepeatWrapping||source.map.wrapT!==RepeatWrapping){source.map.wrapS=source.map.wrapT=RepeatWrapping;source.map.needsUpdate=true;}
 return envPass(material,source.map,1,false,'building',source);
}
function envPass<T extends Material>(material:T,map:Texture,coefficient:number,fbAlpha:boolean,mode:'matfx'|'building',data:NativeEnvSource):T{
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 // matfx_env.frag: fba = max(texel alpha, disableFBA), disableFBA being 1 unless the effect uses framebuffer alpha.
 const uniforms={nativeEnvMap:{value:map},nativeEnvCoefficient:{value:coefficient},nativeEnvDisableFba:{value:fbAlpha?0:1}};
 material.userData.nativeEnv=data;
 nativeEnvCoefficients.set(material,Object.assign(uniforms.nativeEnvCoefficient,{base:coefficient}));
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vNativeEnvUv;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\n{ vec3 nativeEnvNormal = normalize( normalMatrix * normal ); vNativeEnvUv = '+(mode==='building'?'nativeEnvNormal.xy':'vec2( 0.5 + 0.5 * nativeEnvNormal.x, 0.5 - 0.5 * nativeEnvNormal.y )')+'; }');
  // pass2 fogs to black while the texel fogs to the fog colour, so the reflection is added after the fog, faded by it.
  shader.fragmentShader='uniform sampler2D nativeEnvMap; uniform float nativeEnvCoefficient; uniform float nativeEnvDisableFba; varying vec2 vNativeEnvUv;\n'+shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\n{ float nativeEnvFog = 1.0;\n#ifdef USE_FOG\n nativeEnvFog = 1.0 - fogFactor;\n#endif\n gl_FragColor.rgb += texture2D( nativeEnvMap, vNativeEnvUv ).rgb * nativeEnvCoefficient * max( diffuseColor.a, nativeEnvDisableFba ) * nativeEnvFog; }');
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-env-${mode}-v1`;};
 return material;
}
