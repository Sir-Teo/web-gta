import * as THREE from 'three';
import {BIRD_INDICES,MAX_BIRDS,birdVertices,type NativeBirds} from '../world/nativeBirds';

const vertexShader=`attribute vec4 birdColor;varying vec4 vColor;varying vec2 vUv;
void main(){vColor=birdColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// The prelit vertex bytes modulate the raster; they are display values.
const fragmentShader=`uniform sampler2D raster;varying vec4 vColor;varying vec2 vUv;
void main(){vec4 t=texture2D(raster,vUv);vec4 c=vec4(t.rgb*vColor.rgb,t.a*vColor.a);c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));gl_FragColor=c;
 #include <colorspace_fragment>
}`;
/** CBirds::Render (0x712810): each bird's 16 prelit vertices on `cloudmasked` (gpCloudMaskTex), drawn through
 * CBrightLights::RenderOutGeometryBuffer with SRCALPHA/INVSRCALPHA blending, clamped addressing and no fog. */
export class NativeBirdsMesh {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private positions=new Float32Array(MAX_BIRDS*16*3);private colors=new Uint8Array(MAX_BIRDS*16*4);private uvs=new Float32Array(MAX_BIRDS*16*2);
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('birdColor',new THREE.BufferAttribute(this.colors,4,true).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(this.uvs,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(MAX_BIRDS*60),1).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending}));
  // RenderEffects draws the birds first, before the skidmarks and coronas.
  this.mesh.name='Native birds';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=5;
  scene.add(this.mesh);
 }
 get drawnBirds(){return this.mesh.visible?this.mesh.geometry.drawRange.count/60:0;}
 /** Rebuild from the birds' state. `camera` is native; `timeMs` is CTimer::GetTimeInMS. */
 frame(birds:NativeBirds|undefined,timeMs:number,camera:readonly [number,number,number],raster:THREE.Texture|undefined,
  /** The camera's native forward axis and near clip, for CalcScreenCoors' near-plane test. */
  view?:{forward:readonly [number,number,number];near:number}){
  const geometry=this.mesh.geometry,index=geometry.getIndex()!;let stored=0;
  if(birds&&raster&&birds.count>0){
   birds.birds.forEach((bird,slot)=>{
    if(!bird.created)return;
    // CSprite::CalcScreenCoors(..., checkMinVisible): a bird whose view depth is within a unit of the near clip is not drawn.
    if(view){const p=bird.position,f=view.forward;if((p[0]-camera[0])*f[0]+(p[1]-camera[1])*f[1]+(p[2]-camera[2])*f[2]<=view.near+1)return;}
    const v=birdVertices(bird,slot,timeMs,camera),base=stored*16;
    for(let i=0;i<16;i++){
     // Native (x, y, z) is the renderer's (x, z, -y).
     this.positions.set([v.positions[i*3],v.positions[i*3+2],-v.positions[i*3+1]],(base+i)*3);
     this.colors.set(v.colors.subarray(i*4,i*4+4),(base+i)*4);this.uvs.set(v.uvs.subarray(i*2,i*2+2),(base+i)*2);
    }
    for(let i=0;i<30;i++){index.setX(stored*60+i,base+BIRD_INDICES[i]);index.setX(stored*60+30+i,base+BIRD_INDICES[i]+8);}
    stored++;
   });
  }
  this.mesh.visible=stored>0;geometry.setDrawRange(0,stored*60);
  if(stored){
   this.mesh.material.uniforms.raster.value=raster;
   for(const name of ['position','birdColor','uv'])(geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate=true;
   index.needsUpdate=true;
  }
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
