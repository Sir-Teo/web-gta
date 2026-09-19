import * as THREE from 'three';
import type {ShadowFootprint} from './projectShadowReceiver';
import {nativeShadowNearClip} from './nativeShadowDepth';
import type {LightPool} from '../world/nativeEntityLights';

type Receivers=(footprint:ShadowFootprint)=>{chunks:{geometry:{positions:Float32Array;uvs:Float32Array}}[]};
const vertexShader=`attribute vec3 poolColor;uniform mat4 shadowDepthProjection;varying vec2 vUv;varying vec3 vColor;
void main(){vUv=uv*.5+.5;vColor=poolColor;gl_Position=shadowDepthProjection*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader=`uniform sampler2D raster;varying vec2 vUv;varying vec3 vColor;
void main(){vec3 c=texture2D(raster,vUv).rgb*vColor;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,0.);
 #include <colorspace_fragment>
}`;
/** The additive light pools ProcessLightsForEntity stores under lit 2d effects (CShadows::StoreStaticShadow,
 * SHADOW_ADDITIVE, `shad_exp`), drawn as CShadows::RenderStaticShadows does: ONE/ONE, raised 0.06, no fog, no lighting.
 * StoreStaticShadow and GeneratePolysForStaticShadow are retail stubs: the square of half-size `size` is projected
 * down onto collision within its z distance, polygons are kept per light like the static shadow cache, and pools
 * beyond 40 units (the draw distance passed) are not drawn. */
export class NativeLightPools {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 /** Per light: receiver triangles, three vertices each. */
 private cache=new Map<string,{positions:Float32Array;uvs:Float32Array}>();
 private capacity=0;
 drawn=0;
 /** The light position of the first pool drawn last frame, native. */
 first:[number,number,number]|null=null;
 constructor(scene:THREE.Scene){
  const material=new THREE.ShaderMaterial({uniforms:{raster:{value:null},shadowDepthProjection:{value:new THREE.Matrix4()}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor});
  // RenderScene draws static shadows with the camera's near clip pulled out (nativeShadowNearClip), as the player's shadow.
  const direction=new THREE.Vector3();
  material.onBeforeRender=(_renderer,_scene,camera)=>{
   const matrix=material.uniforms.shadowDepthProjection.value as THREE.Matrix4;matrix.copy(camera.projectionMatrix);
   if(!(camera instanceof THREE.PerspectiveCamera)||camera.reversedDepth)return;
   const near=nativeShadowNearClip(camera.near,camera.far,camera.getWorldDirection(direction).y),far=camera.far;
   matrix.elements[10]=-(far+near)/(far-near);matrix.elements[14]=-2*far*near/(far-near);
  };
  this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
  this.mesh.name='Native light pools';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=5.2;
  scene.add(this.mesh);
 }
 /** Forget cached polygons, as a new scene's collision replaces the old. */
 clear(){this.cache.clear();}
 frame(pools:readonly LightPool[],camera:readonly [number,number,number],receivers:Receivers|undefined,raster:THREE.Texture|undefined){
  const shown:{geometry:{positions:Float32Array;uvs:Float32Array};color:[number,number,number];position:[number,number,number]}[]=[];
  if(raster&&receivers)for(const pool of pools){
   if(!pool.intensity||Math.hypot(pool.position[0]-camera[0],pool.position[1]-camera[1])>=40)continue;
   const key=`${pool.id}:${pool.position.map(v=>v.toFixed(2)).join(',')}`;
   let geometry=this.cache.get(key);
   if(!geometry){
    const merged={positions:[] as number[],uvs:[] as number[]};
    try{
     // Native (x, y, z) is the renderer's (x, z, -y); the footprint reaches `maxHeight` below the light.
     for(const {geometry:g} of receivers({center:{x:pool.position[0],y:pool.position[2],z:-pool.position[1]},side:{x:pool.size,z:0},front:{x:0,z:pool.size},depth:pool.maxHeight}).chunks){
      for(let i=0;i<g.positions.length;i+=3)merged.positions.push(g.positions[i],g.positions[i+1]+.06,g.positions[i+2]);
      merged.uvs.push(...g.uvs);
     }
    }catch{/* Over the receiver budget: no pool. */}
    geometry={positions:new Float32Array(merged.positions),uvs:new Float32Array(merged.uvs)};
    this.cache.set(key,geometry);
   }
   if(geometry.positions.length)shown.push({geometry,color:pool.color,position:pool.position});
  }
  // RenderStaticShadows scales the vertex alpha by (1 - Foggyness / 2), which additive blending ignores.
  const vertices=shown.reduce((n,s)=>n+s.geometry.positions.length/3,0);
  this.drawn=shown.length;this.first=shown[0]?.position??null;this.mesh.visible=vertices>0;
  if(!vertices)return;
  const geometry=this.mesh.geometry;
  if(vertices>this.capacity||!geometry.getAttribute('position')){
   this.capacity=Math.max(vertices,this.capacity*2,1024);
   geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(this.capacity*2),2).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('poolColor',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
  }
  const position=geometry.getAttribute('position') as THREE.BufferAttribute,uv=geometry.getAttribute('uv') as THREE.BufferAttribute,color=geometry.getAttribute('poolColor') as THREE.BufferAttribute;
  const positions=position.array as Float32Array,uvs=uv.array as Float32Array,colors=color.array as Float32Array;
  let v=0;
  for(const s of shown){
   positions.set(s.geometry.positions,v*3);uvs.set(s.geometry.uvs,v*2);
   for(let k=0;k<s.geometry.positions.length/3;k++)colors.set([s.color[0]/255,s.color[1]/255,s.color[2]/255],(v+k)*3);
   v+=s.geometry.positions.length/3;
  }
  position.needsUpdate=uv.needsUpdate=color.needsUpdate=true;geometry.setDrawRange(0,vertices);
  this.mesh.material.uniforms.raster.value=raster;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
