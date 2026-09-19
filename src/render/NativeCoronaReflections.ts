import * as THREE from 'three';
import {GAME_CAMERA_FOV} from './cameraProjection';
import {projectCorona} from './coronaProjection';
import {MAX_NUM_CORONAS,coronaIntensity,type CoronaReflection} from '../world/nativeCoronas';

const vertexShader=`attribute vec2 corner;attribute vec3 center;attribute vec2 extent;attribute vec4 tint;varying vec2 vUv;varying vec4 vTint;
void main(){vUv=vec2(corner.x*.5+.5,.5-corner.y*.5);vTint=tint;gl_Position=vec4(center.xy+corner*extent,0.,1.);}`;
// CSprite's vertex colour (rgb × intensity / 256) modulates the raster in display space; additive (ONE, ONE).
const fragmentShader=`uniform sampler2D raster;varying vec2 vUv;varying vec4 vTint;
void main(){vec3 c=texture2D(raster,vUv).rgb*vTint.rgb*vTint.a;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,0.);
 #include <colorspace_fragment>
}`;
/** CCoronas::RenderReflections' sprites: `coronareflect`, 0.75 × 2 of the corona's size, additive, unfogged and not depth
 * tested. RenderScene draws them after the roads and before everything else, so the other geometry covers them: they
 * sit in the opaque pass between the road meshes (render order −2) and the rest. */
export class NativeCoronaReflections {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private center=new Float32Array(MAX_NUM_CORONAS*12);private extent=new Float32Array(MAX_NUM_CORONAS*8);private tint=new Float32Array(MAX_NUM_CORONAS*16);
 private point=new THREE.Vector3();private clip=new THREE.Vector3();
 drawn=0;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry(),corner=new Float32Array(MAX_NUM_CORONAS*8),index=new Uint16Array(MAX_NUM_CORONAS*6);
  for(let i=0;i<MAX_NUM_CORONAS;i++){corner.set([-1,1,1,1,1,-1,-1,-1],i*8);index.set([0,1,2,0,2,3].map(v=>i*4+v),i*6);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_NUM_CORONAS*12),3));
  geometry.setAttribute('corner',new THREE.BufferAttribute(corner,2));
  geometry.setAttribute('center',new THREE.BufferAttribute(this.center,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('extent',new THREE.BufferAttribute(this.extent,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint',new THREE.BufferAttribute(this.tint,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null}},vertexShader,fragmentShader,transparent:false,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor}));
  this.mesh.name='Native corona reflections';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=-1;
  scene.add(this.mesh);
 }
 /** Projects each reflection (CSprite::CalcScreenCoors, far and near checks) and colours it
  * WetRoads × intensity × (1 − h / 20) × 230 / 256 of the corona's colour, at intensity 128. */
 frame(camera:THREE.PerspectiveCamera,reflections:readonly CoronaReflection[],wetRoads:number,raster:THREE.Texture|undefined,sourceFov=GAME_CAMERA_FOV){
  let n=0;
  if(raster)for(const r of reflections){
   if(n>=MAX_NUM_CORONAS)break;
   // Native (x, y, z) is the renderer's (x, z, -y).
   this.point.set(r.position[0],r.position[2],-r.position[1]);
   const onScreen=projectCorona(camera,this.point,1,1,sourceFov);
   if(!onScreen||onScreen.depth>=r.farClip)continue;
   const t=wetRoads*coronaIntensity(onScreen.depth,r.farClip)*r.heightFactor*230;
   const clip=this.clip.copy(this.point).project(camera);
   for(let v=0;v<4;v++){
    this.center.set([clip.x,clip.y,0],(n*4+v)*3);
    this.extent.set([onScreen.widthScale*r.size*.75*2,onScreen.heightScale*r.size*2*2],(n*4+v)*2);
    // RenderBufferedOneXLUSprite at intensity 128: each byte × 128 >> 8.
    this.tint.set([((Math.trunc(r.color[0]*t)>>8&255)*128>>8)/255,((Math.trunc(r.color[1]*t)>>8&255)*128>>8)/255,((Math.trunc(r.color[2]*t)>>8&255)*128>>8)/255,1],(n*4+v)*4);
   }
   n++;
  }
  this.drawn=n;this.mesh.visible=n>0;this.mesh.geometry.setDrawRange(0,n*6);
  if(n){
   this.mesh.material.uniforms.raster.value=raster;
   for(const name of ['center','extent','tint'])(this.mesh.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate=true;
  }
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
