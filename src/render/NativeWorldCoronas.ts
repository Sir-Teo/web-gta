import * as THREE from 'three';
import {GAME_CAMERA_FOV} from './cameraProjection';
import {projectCorona} from './coronaProjection';
import {MAX_NUM_CORONAS,coronaIntensity,type NativeCoronas} from '../world/nativeCoronas';

const vertexShader=`attribute vec2 corner;attribute vec3 center;attribute vec2 extent;attribute vec4 tint;varying vec2 vUv;varying vec4 vTint;
void main(){vUv=vec2(corner.x*.5+.5,.5-corner.y*.5);vTint=tint;gl_Position=vec4(center.xy+corner*extent,center.z,1.);}`;
// CSprite's vertex colour (rgb × intensity / 256) modulates the raster in display space; additive (ONE, ONE).
const fragmentShader=`uniform sampler2D raster;varying vec2 vUv;varying vec4 vTint;
void main(){vec3 c=texture2D(raster,vUv).rgb*vTint.rgb*vTint.a;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,0.);
 #include <colorspace_fragment>
}`;
/** CCoronas::Render (0x6FAEC0) for textured coronas: each a camera-facing CSprite::RenderOneXLUSprite_Rotate_Aspect
 * quad, pulled toward the camera by its near clip, faded from half its far clip and stretched by fog. Sets each
 * corona's off-screen flag, which the next CCoronas::Update reads. Flares and wet-road reflections are not drawn. */
export class NativeWorldCoronas {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private center=new Float32Array(MAX_NUM_CORONAS*12);private extent=new Float32Array(MAX_NUM_CORONAS*8);private tint=new Float32Array(MAX_NUM_CORONAS*16);
 private point=new THREE.Vector3();private pulled=new THREE.Vector3();private cameraPosition=new THREE.Vector3();
 drawn=0;
 /** The NDC centre of the first corona drawn last frame. */
 firstCenter:[number,number]|null=null;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry(),corner=new Float32Array(MAX_NUM_CORONAS*8),index=new Uint16Array(MAX_NUM_CORONAS*6);
  for(let i=0;i<MAX_NUM_CORONAS;i++){corner.set([-1,1,1,1,1,-1,-1,-1],i*8);index.set([0,1,2,0,2,3].map(v=>i*4+v),i*6);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_NUM_CORONAS*12),3));
  geometry.setAttribute('corner',new THREE.BufferAttribute(corner,2));
  geometry.setAttribute('center',new THREE.BufferAttribute(this.center,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('extent',new THREE.BufferAttribute(this.extent,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint',new THREE.BufferAttribute(this.tint,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor}));
  // RenderEffects: after the birds, skidmarks and glass.
  this.mesh.name='Native coronas';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=6;
  scene.add(this.mesh);
 }
 /** `foggyness` is CWeather::Foggyness. */
 frame(camera:THREE.PerspectiveCamera,coronas:NativeCoronas,raster:THREE.Texture|undefined,foggyness:number,sourceFov=GAME_CAMERA_FOV){
  let n=0;camera.getWorldPosition(this.cameraPosition);
  for(const c of coronas.coronas){
   if(!c.id||!c.faded&&!c.alpha)continue;
   // Native (x, y, z) is the renderer's (x, z, -y).
   this.point.set(c.position[0],c.position[2],-c.position[1]);
   const onScreen=projectCorona(camera,this.point,1,1,sourceFov);
   c.offScreen=!onScreen||onScreen.x<0||onScreen.x>1||onScreen.y<0||onScreen.y>1;
   if(!onScreen||!c.faded||onScreen.depth>=c.farClip||!raster)continue;
   const intensity=Math.trunc(c.faded*coronaIntensity(onScreen.depth,c.farClip));
   const scale=Math.min(40,onScreen.depth)*foggyness/40+1;
   this.pulled.copy(this.point).sub(this.cameraPosition).normalize().multiplyScalar(-c.nearClip).add(this.point);
   const pulled=projectCorona(camera,this.pulled,1,1,sourceFov);if(!pulled)continue;
   const clip=this.pulled.clone().project(camera);
   for(let v=0;v<4;v++){
    this.center.set([clip.x,clip.y,clip.z],(n*4+v)*3);
    this.extent.set([pulled.widthScale*c.size*2,pulled.heightScale*c.size*scale*2],(n*4+v)*2);
    this.tint.set([Math.trunc(c.color[0]/scale)/255,Math.trunc(c.color[1]/scale)/255,Math.trunc(c.color[2]/scale)/255,intensity/256],(n*4+v)*4);
   }
   n++;
  }
  this.drawn=n;this.firstCenter=n?[this.center[0],this.center[1]]:null;this.mesh.visible=n>0;this.mesh.geometry.setDrawRange(0,n*6);
  if(n){
   this.mesh.material.uniforms.raster.value=raster;
   for(const name of ['center','extent','tint'])(this.mesh.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate=true;
  }
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
