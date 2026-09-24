import * as THREE from 'three';
import type {ShadowFootprint} from './projectShadowReceiver';
import {nativeShadowNearClip} from './nativeShadowDepth';
import type {LightPool} from '../world/nativeEntityLights';

type Receivers=(footprint:ShadowFootprint)=>{chunks:{geometry:{positions:Float32Array;uvs:Float32Array}}[]};
// projectShadowReceiver already maps the footprint to 0..1 texture coordinates.
const vertexShader=`attribute vec4 poolColor;uniform mat4 shadowDepthProjection;varying vec2 vUv;varying vec4 vColor;
void main(){vUv=uv;vColor=poolColor;gl_Position=shadowDepthProjection*modelViewMatrix*vec4(position,1.);}`;
/** Additive pools ignore alpha; SHADOW_DEFAULT shadows blend by the raster's alpha times the vertex intensity. */
const fragmentShader=(alpha:boolean)=>`uniform sampler2D raster;varying vec2 vUv;varying vec4 vColor;
void main(){if(any(lessThan(vUv,vec2(0.)))||any(greaterThan(vUv,vec2(1.))))discard;vec4 t=texture2D(raster,vUv);vec3 c=t.rgb*vColor.rgb;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,${alpha?'t.a*vColor.a':'0.'});
 #include <colorspace_fragment>
}`;
/** How much larger than the footprint a receiver cut is made, and how much deeper, so a moving pool can reuse it. */
const CUT_MARGIN=1.25,CUT_SLACK=.1;
interface CutEntry {depth:number;center:{x:number;y:number;z:number};side:{x:number;z:number};front:{x:number;z:number};positions:Float32Array;uvs:Float32Array;seen:number}
/** Whether the footprint at `center` (same shape) still lies inside the cut, and its top within CUT_SLACK of the cut's. */
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-3;
function fitsCut(entry:CutEntry,side:{x:number;z:number},front:{x:number;z:number},center:{x:number;y:number;z:number},depth:number){
 if(entry.depth!==depth||!near(entry.side.x,side.x)||!near(entry.side.z,side.z)||!near(entry.front.x,front.x)||!near(entry.front.z,front.z)||Math.abs(center.y-entry.center.y)>CUT_SLACK)return false;
 const det=side.x*front.z-front.x*side.z,x=center.x-entry.center.x,z=center.z-entry.center.z;
 // In the footprint's own units the cut spans ±CUT_MARGIN and the footprint ±1 about its centre.
 const du=(x*front.z-front.x*z)/det,dv=(side.x*z-x*side.z)/det;
 return Math.abs(du)+1<=CUT_MARGIN&&Math.abs(dv)+1<=CUT_MARGIN;
}
/** The additive light pools ProcessLightsForEntity stores under lit 2d effects (CShadows::StoreStaticShadow,
 * SHADOW_ADDITIVE, `shad_exp`), drawn as CShadows::RenderStaticShadows does: ONE/ONE, raised 0.06, no fog, no lighting.
 * StoreStaticShadow and GeneratePolysForStaticShadow are retail stubs: the square of half-size `size` is projected
 * down onto collision within its z distance, polygons are kept per light like the static shadow cache, and pools
 * beyond 40 units (the draw distance passed) are not drawn. */
export class NativeLightPools {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 /** Per light id: the receiver triangles (three vertices each) cut around a pose, and the frame it was last drawn.
  * A moving light (a car's headlight pool, a walking ped) reuses its cut while it stays inside, then replaces it. */
 private cache=new Map<number,CutEntry>();
 private shown:{positions:Float32Array;uvs:Float32Array;color:readonly [number,number,number];intensity:number;position:[number,number,number]}[]=[];
 private frames=0;
 private capacity=0;
 drawn=0;
 /** The light position of the first pool drawn last frame, native. */
 first:[number,number,number]|null=null;
 /** `alpha` draws CShadows' SHADOW_DEFAULT (SRCALPHA, INVSRCALPHA) instead of SHADOW_ADDITIVE (ONE, ONE). */
 constructor(scene:THREE.Scene,options:{blend?:'additive'|'alpha';name?:string;renderOrder?:number}={}){
  const alpha=options.blend==='alpha';
  const material=new THREE.ShaderMaterial({uniforms:{raster:{value:null},shadowDepthProjection:{value:new THREE.Matrix4()}},vertexShader,fragmentShader:fragmentShader(alpha),transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   blending:THREE.CustomBlending,blendSrc:alpha?THREE.SrcAlphaFactor:THREE.OneFactor,blendDst:alpha?THREE.OneMinusSrcAlphaFactor:THREE.OneFactor});
  // RenderScene draws static shadows with the camera's near clip pulled out (nativeShadowNearClip), as the player's shadow.
  const direction=new THREE.Vector3();
  material.onBeforeRender=(_renderer,_scene,camera)=>{
   const matrix=material.uniforms.shadowDepthProjection.value as THREE.Matrix4;matrix.copy(camera.projectionMatrix);
   if(!(camera instanceof THREE.PerspectiveCamera)||camera.reversedDepth)return;
   const near=nativeShadowNearClip(camera.near,camera.far,camera.getWorldDirection(direction).y),far=camera.far;
   matrix.elements[10]=-(far+near)/(far-near);matrix.elements[14]=-2*far*near/(far-near);
  };
  this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
  this.mesh.name=options.name??'Native light pools';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=options.renderOrder??5.2;
  scene.add(this.mesh);
 }
 /** Forget cached polygons, as a new scene's collision replaces the old. */
 clear(){this.cache.clear();}
 /** Cached lights, for tests. */
 get cached(){return this.cache.size;}
 frame(pools:readonly LightPool[],camera:readonly [number,number,number],receivers:Receivers|undefined,raster:THREE.Texture|undefined){
  const shown=this.shown;shown.length=0;
  if(raster&&receivers)for(const pool of pools){
   if(!pool.intensity&&pool.color.every(c=>!c)||Math.hypot(pool.position[0]-camera[0],pool.position[1]-camera[1])>=(pool.maxDistance??40))continue;
   // Native (x, y, z) is the renderer's (x, z, -y); the footprint reaches `maxHeight` below the light.
   const side=pool.side?{x:pool.side[0],z:-pool.side[1]}:{x:pool.size,z:0},front=pool.front?{x:pool.front[0],z:-pool.front[1]}:{x:0,z:pool.size};
   const center={x:pool.position[0],y:pool.position[2],z:-pool.position[1]},det=side.x*front.z-front.x*side.z;
   if(Math.abs(det)<1e-10)continue;
   let entry=this.cache.get(pool.id);
   if(!entry||!fitsCut(entry,side,front,center,pool.maxHeight)){
    // Cut a footprint CUT_MARGIN larger and a little deeper once; the pool reuses it while it stays inside, its UVs
    // taken from the exact pose each frame and the shader discarding what lies outside the real footprint.
    const merged:number[]=[];
    try{
     for(const {geometry:g} of receivers({center,side:{x:side.x*CUT_MARGIN,z:side.z*CUT_MARGIN},front:{x:front.x*CUT_MARGIN,z:front.z*CUT_MARGIN},depth:pool.maxHeight+CUT_SLACK}).chunks)
      for(let i=0;i<g.positions.length;i+=3)merged.push(g.positions[i],g.positions[i+1]+.06,g.positions[i+2]);
    }catch{/* Over the receiver budget: no pool. */}
    const positions=new Float32Array(merged);
    entry={depth:pool.maxHeight,center:{...center},side:{...side},front:{...front},positions,uvs:new Float32Array(positions.length/3*2),seen:this.frames};
    this.cache.set(pool.id,entry);
   }
   entry.seen=this.frames;
   if(!entry.positions.length)continue;
   // projectShadowReceiver's U along `side`, V along `front`, each -1..1 across the footprint, mapped to 0..1.
   const {positions,uvs}=entry;
   for(let i=0,j=0;i<positions.length;i+=3,j+=2){
    const x=positions[i]-center.x,z=positions[i+2]-center.z;
    uvs[j]=((x*front.z-front.x*z)/det+1)/2;uvs[j+1]=((side.x*z-x*side.z)/det+1)/2;
   }
   shown.push({positions,uvs,color:pool.color,intensity:pool.intensity,position:pool.position});
  }
  // Lights not drawn for a while (out of range, or a car gone) give their polygons back.
  if(++this.frames%120===0)for(const [id,entry] of this.cache)if(this.frames-entry.seen>600)this.cache.delete(id);
  // RenderStaticShadows scales the vertex alpha by (1 - Foggyness / 2), which additive blending ignores.
  let vertices=0;for(const s of shown)vertices+=s.positions.length/3;
  this.drawn=shown.length;this.first=shown[0]?.position??null;this.mesh.visible=vertices>0;
  if(!vertices)return;
  const geometry=this.mesh.geometry;
  if(vertices>this.capacity||!geometry.getAttribute('position')){
   this.capacity=Math.max(vertices,this.capacity*2,1024);
   geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(this.capacity*2),2).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('poolColor',new THREE.BufferAttribute(new Float32Array(this.capacity*4),4).setUsage(THREE.DynamicDrawUsage));
  }
  const position=geometry.getAttribute('position') as THREE.BufferAttribute,uv=geometry.getAttribute('uv') as THREE.BufferAttribute,color=geometry.getAttribute('poolColor') as THREE.BufferAttribute;
  const positions=position.array as Float32Array,uvs=uv.array as Float32Array,colors=color.array as Float32Array;
  let v=0;
  for(const s of shown){
   positions.set(s.positions,v*3);uvs.set(s.uvs,v*2);
   const r=s.color[0]/255,g=s.color[1]/255,b=s.color[2]/255,a=s.intensity/255,n=s.positions.length/3;
   for(let k=0,c=v*4;k<n;k++,c+=4){colors[c]=r;colors[c+1]=g;colors[c+2]=b;colors[c+3]=a;}
   v+=n;
  }
  for(const attribute of [position,uv,color]){attribute.clearUpdateRanges();attribute.addUpdateRange(0,vertices*attribute.itemSize);attribute.needsUpdate=true;}
  geometry.setDrawRange(0,vertices);
  this.mesh.material.uniforms.raster.value=raster;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
