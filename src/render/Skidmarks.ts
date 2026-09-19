import * as THREE from 'three';
import {decodeNamedTextures} from '../assets/modelTextures';
import {nativeTexture} from '../assets/nativeTexture';
import type {WorldCar} from '../simulation/WorldCar';
import {NativeSkidmarks,SKIDMARK_NUM_PARTS,SKIDMARK_STATE,SKIDMARK_TYPE,SKIDMARKS_COUNT,skidmarkColour,skidmarkPartAlpha,wheelLaysSkidmark,type SkidmarkType} from './nativeSkidmarks';

/** eCarWheel order: front left, rear left, front right, rear right. */
const REAR=[false,true,false,true];
const TYPES:Record<string,SkidmarkType>={DEFAULT:SKIDMARK_TYPE.DEFAULT,SANDY:SKIDMARK_TYPE.SANDY,MUDDY:SKIDMARK_TYPE.MUDDY};
const vertexShader=`attribute vec4 skidColor;
varying vec4 vColor;
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){
 vColor=skidColor;vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
/** Prelit vertex colour modulates the particleskid raster, then fog; as the FX renderer does for Im3D. */
const fragmentShader=`uniform sampler2D raster;
uniform bool textured;
varying vec4 vColor;
varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
 vec4 c=vColor*(textured?texture2D(raster,vUv):vec4(1.));
 if(c.a<=0.)discard;
 c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));
 gl_FragColor=c;
 #include <fog_fragment>
 #include <colorspace_fragment>
}`;

/** CSkidmarks on the browser scene: the native marks (nativeSkidmarks.ts), laid by CAutomobile::PreRender's
 * wheel rule and drawn as CSkidmark::Render's strips with the particleskid raster from particle.txd. */
export class Skidmarks {
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 readonly marks=new NativeSkidmarks();
 private positions=new Float32Array(SKIDMARKS_COUNT*SKIDMARK_NUM_PARTS*2*3);
 private uvs=new Float32Array(SKIDMARKS_COUNT*SKIDMARK_NUM_PARTS*2*2);
 private colours=new Float32Array(SKIDMARKS_COUNT*SKIDMARK_NUM_PARTS*2*4);
 private texture?:THREE.Texture;
 private frustum=new THREE.Frustum();private projection=new THREE.Matrix4();private sphere=new THREE.Sphere();
 private forward=new THREE.Vector3();private disposed=false;
 constructor(private scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry(),index=new Uint16Array(SKIDMARKS_COUNT*(SKIDMARK_NUM_PARTS-1)*6);
  geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(this.uvs,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('skidColor',new THREE.BufferAttribute(this.colours,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index,1).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
  // Z writes off, vertex alpha, SRCALPHA / INVSRCALPHA and fog, as CSkidmarks::Render sets them.
  const material=new THREE.ShaderMaterial({uniforms:{raster:{value:null},textured:{value:false},...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)},vertexShader,fragmentShader,fog:true,
   transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
  this.mesh=new THREE.Mesh(geometry,material);this.mesh.name='Skidmarks';this.mesh.frustumCulled=false;this.mesh.matrixAutoUpdate=false;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 /** CSkidmarks::Init: particleskid from particle.txd. The raster is sampled with the ambient linear, wrapping
  * state, as Render sets only the raster. */
 async loadTexture(particle:File){
  const [source]=decodeNamedTextures(['particleskid'],new Uint8Array(await particle.arrayBuffer()));
  if(this.disposed||!source)return false;
  const texture=nativeTexture(source);texture.magFilter=THREE.LinearFilter;texture.minFilter=texture.mipmaps.length>1?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  this.texture?.dispose();this.texture=texture;this.mesh.material.uniforms.raster.value=texture;this.mesh.material.uniforms.textured.value=true;return true;
 }
 /** CSkidmarks::Update, once per game frame before the cars register their wheels. */
 update(now:number){if(!this.disposed)this.marks.update(now);}
 /** CAutomobile::PreRender's wheel loop for one car. `skidMark` is the SURFINFO.DAT skidmark class of a COL
  * material and `water` whether it is water. */
 lay(car:WorldCar,now:number,surfaces:{skidMark(material:number):string|undefined;water(material:number):boolean},camera:THREE.Camera){
  if(this.disposed)return;
  const q=car.car.body.rotation();this.forward.set(0,0,-1).applyQuaternion(q);
  const dirX=this.forward.x,dirY=-this.forward.z,states=car.audio.states;
  const rearSkidding=states[1]==='skidding'||states[3]==='skidding';
  for(let i=0;i<4;i++){
   const ground=car.wheelGround[i];
   // m_aSuspensionSpringRatioPrev < 1 off water, and m_aWheelTimer > 0.
   if(!ground||surfaces.water(ground.material)||car.audio.counts[i]<=0)continue;
   const type=TYPES[surfaces.skidMark(ground.material)??'DEFAULT']??SKIDMARK_TYPE.DEFAULT;
   if(!wheelLaysSkidmark({state:states[i],rear:REAR[i],rearSkidding,muddy:type===SKIDMARK_TYPE.MUDDY,bloody:car.wheelBlood[i]}))continue;
   car.wheelBlood[i]=this.marks.registerOne({id:car.car.body.handle*8+i,position:ground,dirX,dirY,type,bloody:car.wheelBlood[i],now,visible:(center,radius)=>this.visible(camera,center,radius)});
  }
 }
 private visible(camera:THREE.Camera,center:{x:number;y:number;z:number},radius:number){
  this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);
  return this.frustum.intersectsSphere(this.sphere.set(new THREE.Vector3(center.x,center.z,-center.y),radius));
 }
 /** CSkidmarks::Render: each live mark's points become a strip 0.1 above the ground, V running 5.01 per point. */
 render(now:number,dayNightBalance:number){
  if(this.disposed)return;
  const index=this.mesh.geometry.index!,indices=index.array as Uint16Array;
  let vertex=0,count=0;
  for(const mark of this.marks.marks){
   if(mark.state===SKIDMARK_STATE.INACTIVE||!mark.parts)continue;
   const [r,g,b,a]=skidmarkColour(mark,now,dayNightBalance),first=vertex;
   for(let part=0;part<=mark.parts;part++){
    const x=mark.positions[part*3],y=mark.positions[part*3+1],z=mark.positions[part*3+2]+.1,dx=mark.dirX[part],dy=mark.dirY[part];
    const alpha=skidmarkPartAlpha(mark,part,a)/255;
    for(let side=0;side<2;side++){
     const s=side?-1:1,o=vertex*3;
     // Native (x, y, z) to the browser's (x, z, −y).
     this.positions[o]=x+s*dx;this.positions[o+1]=z;this.positions[o+2]=-(y+s*dy);
     this.uvs[vertex*2]=side;this.uvs[vertex*2+1]=part*5.01;
     this.colours.set([r/255,g/255,b/255,alpha],vertex*4);vertex++;
    }
   }
   // CSkidmarks::Init's index pattern {0, 2, 1, 1, 2, 3} per segment.
   for(let part=0;part<mark.parts;part++){const v=first+part*2;indices.set([v,v+2,v+1,v+1,v+2,v+3],count);count+=6;}
  }
  const geometry=this.mesh.geometry;
  for(const name of ['position','uv','skidColor'])(geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate=true;
  index.needsUpdate=true;geometry.setDrawRange(0,count);this.mesh.visible=count>0;
 }
 /** CSkidmarks::Clear. */
 clear(){this.marks.clear();this.mesh.visible=false;}
 snapshot(){return {marks:this.marks.marks.filter(m=>m.state!==SKIDMARK_STATE.INACTIVE).length,textured:!!this.texture};}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture?.dispose();this.marks.clear();
 }
}
