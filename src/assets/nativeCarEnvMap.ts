import {Vector2,type Material,type Texture} from 'three';
import type {CarEnvMaterial} from './dff';
/** CCustomCarEnvMapPipeline (the PC vehicle pipeline, reversed): a material with a non-zero reflection shininess and a
 * MatFX env texture reflects in one of two styles, picked by the env texture's name.
 * - SHINE_CAM (any other name, e.g. vehicleenvmap128): the camera-space normal, projected through the transform
 *   (sx·nx + u·nz, sy·ny + v·nz, nz) with u, v = −fmod(pos, 50·transScl) / (50·transScl) from the car's position, and
 *   added (MULTIPLYADD) at min(255, shininess × specIntensity × 254) / 255.
 * - SHINE_WAVE (a name starting with 'x', e.g. xvehicleenv128, and a second UV set): the second UV set shifted by
 *   (−OffsetU, v), where OffsetU slides with the car's travel and v = clamp(up.x + up.y, 0, 0.1) (1 − v upside
 *   down), blended over the texel at alpha min(255, specIntensity × 24) / 255 (BLENDFACTORALPHA).
 * specIntensity is gSpecIntensity × 1.85: the entity's SetupLightingForEntity multiplier,
 * GetLightingFromCol(true) × 0.95 + 0.05 (times the unreversed point-light factor, taken as 1). */
export interface NativeCarEnvState {
 /** gSpecIntensity × 1.85. */ specIntensity:{value:number};
 /** The car root's native x, y (SHINE_CAM's u, v). */ position:{value:Vector2};
 /** (−OffsetU, v) for SHINE_WAVE. */ wave:{value:Vector2};
 /** Reflections off: a blown-up car. */ enabled:{value:boolean};
}
export const nativeCarEnvState=():NativeCarEnvState=>({specIntensity:{value:1.85},position:{value:new Vector2()},wave:{value:new Vector2()},enabled:{value:true}});
/** The reflection style a material takes, or none. */
export function nativeCarEnvStyle(env:CarEnvMaterial|undefined,envTexture:string|undefined,hasSecondUv:boolean):'cam'|'wave'|undefined{
 if(!env||env.shininess===0||!envTexture)return undefined;
 if(envTexture.toLowerCase().startsWith('x'))return hasSecondUv?'wave':undefined;
 return 'cam';
}
export function nativeCarEnvMaterial<T extends Material>(material:T,map:Texture,env:CarEnvMaterial,style:'cam'|'wave',state:NativeCarEnvState):T{
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 const uniforms={nativeCarEnvMap:{value:map},nativeCarShininess:{value:env.shininess},nativeCarEnvScale:{value:new Vector2(env.scaleX,env.scaleY)},
  nativeCarEnvTrans:{value:new Vector2(env.transSclX*50,env.transSclY*50)},nativeCarSpecIntensity:state.specIntensity,nativeCarPos:state.position,nativeCarWave:state.wave,nativeCarEnvOn:state.enabled};
 material.userData.nativeCarEnv={map,env,style};
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  Object.assign(shader.uniforms,uniforms);
  const common='uniform sampler2D nativeCarEnvMap; uniform float nativeCarShininess; uniform vec2 nativeCarEnvScale; uniform vec2 nativeCarEnvTrans; uniform float nativeCarSpecIntensity; uniform vec2 nativeCarPos; uniform vec2 nativeCarWave; uniform bool nativeCarEnvOn;\n';
  if(style==='cam'){
   // D3DTSS_TCI_CAMERASPACENORMAL in D3D's left-handed camera space: three's view normal with z negated.
   shader.vertexShader=common+'varying vec3 vNativeCarEnv;\n'+shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
{ vec3 n = normalize( normalMatrix * normal ); n.z = -n.z;
  vec2 uv = -( nativeCarPos - nativeCarEnvTrans * trunc( nativeCarPos / nativeCarEnvTrans ) ) / nativeCarEnvTrans;
  vNativeCarEnv = vec3( nativeCarEnvScale.x * n.x + uv.x * n.z, nativeCarEnvScale.y * n.y + uv.y * n.z, n.z ); }`);
   shader.fragmentShader=common+'varying vec3 vNativeCarEnv;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`if ( nativeCarEnvOn ) {
  vec3 env = texture2D( nativeCarEnvMap, vNativeCarEnv.xy / vNativeCarEnv.z ).rgb;
  float factor = min( 255.0, floor( nativeCarShininess * nativeCarSpecIntensity * 254.0 ) ) / 255.0;
  gl_FragColor.rgb += env * factor; }
#include <fog_fragment>`);
  }else{
   shader.vertexShader=common+'#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\nvarying vec2 vNativeCarWaveUv;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\nvNativeCarWaveUv = uv1 + nativeCarWave;');
   shader.fragmentShader=common+'varying vec2 vNativeCarWaveUv;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`if ( nativeCarEnvOn ) {
  float a = min( 255.0, floor( nativeCarSpecIntensity * 24.0 ) ) / 255.0;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, texture2D( nativeCarEnvMap, vNativeCarWaveUv ).rgb, a ); }
#include <fog_fragment>`);
  }
 };
 material.customProgramCacheKey=function(){return `${key.call(this)}-native-car-env-${style}-v1`;};
 return material;
}
/** The SHINE_WAVE offset's per-frame step (0x5D8590): tri(p, s) folds the position into a 0..1 zigzag over 2s, and
 * OffsetU moves by the change of tri(x) + tri(y), signed by the travel along the car's forward, wrapped into 0..1. */
export function nativeCarWaveStep(offsetU:number,prev:{x:number;y:number},pos:{x:number;y:number},forward:{x:number;y:number},trans:{x:number;y:number}){
 const tri=(p:number,s:number)=>{const n=Math.trunc(p/s),t=Math.abs((p-n*s)/s);return n%2===0?1-t:t;};
 const sx=trans.x*50,sy=trans.y*50;
 const delta=(tri(prev.x,sx)+tri(prev.y,sy))-(tri(pos.x,sx)+tri(pos.y,sy));
 const dir=(pos.x-prev.x)*forward.x+(pos.y-prev.y)*forward.y;
 const next=offsetU+(dir<0?-Math.abs(delta):Math.abs(delta));
 return next-Math.floor(next);
}
/** One vehicle's car-pipeline state and its per-frame update from the body (renderer space) and the lighting. */
export class NativeCarReflection {
 readonly state=nativeCarEnvState();
 private offsetU=0;private prev?:{x:number;y:number};private trans={x:1,y:1};
 /** SHINE_WAVE's transScl, from the model's first wave material. */
 useModel(model:{geometries:readonly {materials:readonly {carEnv?:CarEnvMaterial;envMap?:{texture:string}}[]}[]}){
  const first=model.geometries.flatMap(g=>g.materials).find(m=>m.carEnv&&m.carEnv.shininess&&m.envMap?.texture.toLowerCase().startsWith('x'));
  if(first?.carEnv)this.trans={x:first.carEnv.transSclX,y:first.carEnv.transSclY};
 }
 /** `lighting` is SetupLightingForEntity's multiplier; `rotation` is the body's quaternion. */
 update(lighting:number,position:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number}){
  const {x,y,z,w}=rotation;
  // The body's up (0,1,0) and forward (0,0,−1) rotated, then to native axes (x, −z, y).
  const up={x:2*(x*y-w*z),y:1-2*(x*x+z*z),z:2*(y*z+w*x)},forward={x:-2*(x*z+w*y),y:-2*(y*z-w*x),z:-(1-2*(x*x+y*y))};
  const pos={x:position.x,y:-position.z},upN={x:up.x,y:-up.z,z:up.y},fwdN={x:forward.x,y:-forward.z};
  this.state.specIntensity.value=lighting*1.85;this.state.position.value.set(pos.x,pos.y);
  this.offsetU=this.prev?nativeCarWaveStep(this.offsetU,this.prev,pos,fwdN,this.trans):0;this.prev=pos;
  let v=Math.min(.1,Math.max(0,upN.x+upN.y));if(upN.z<0)v=1-v;
  this.state.wave.value.set(-this.offsetU,v);
 }
}
