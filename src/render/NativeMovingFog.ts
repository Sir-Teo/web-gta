import * as THREE from 'three';
/** MAX_MOVING_FOG (Clouds.h). */
export const MAX_MOVING_FOG=350;
/** CPostEffects::m_fWaterFXStartUnderWaterness (0x8D514C). */
const WATER_FX_START_UNDERWATERNESS=.535;
/** Frame limiter default (RsGlobal.frameLimit = APP_MAX_FPS 30): wind drift is applied per frame, not per time step. */
export const MOVING_FOG_FRAME_MS=1000/30;
export interface NativeFogVec {x:number;y:number;z:number}
export interface MovingFogInput {
 /** CWeather::Foggyness_SF (MovingFog_GetFXIntensity). */
 foggynessSF:number;
 /** CGame::CanSeeOutSideFromCurrArea() or the player in the normal world. */
 outside:boolean;
 /** CCullZones::CamNoRain() && CCullZones::PlayerNoRain(). */
 noRain:boolean;
 /** CWeather::UnderWaterness. */
 underwaterness:number;
 /** CTimeCycle::m_CurrentColours sky bottom bytes. */
 skyBottom:readonly [number,number,number];
}
const vertexShader=`attribute vec4 fogColor;varying vec4 vColor;varying vec2 vUv;
void main(){vColor=fogColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// RenderWare modulates the raster by the vertex colour; the bytes are display values.
const fragmentShader=`uniform sampler2D raster;varying vec4 vColor;varying vec2 vUv;
void main(){vec4 t=texture2D(raster,vUv);vec4 c=vec4(t.rgb*vColor.rgb,t.a*vColor.a);c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));gl_FragColor=c;
 #include <colorspace_fragment>
}`;
/** CClouds moving fog (gta-reversed 0076f901, Clouds.cpp 0x713660-0x716C90): 350 camera-facing `cloudmasked` sprites
 * drifting on a fixed wind around the camera while San Francisco fog is active. */
export class NativeMovingFog {
 /** tMovingFog (0xC6C158). */
 readonly slots=new Uint8Array(MAX_MOVING_FOG);readonly position=new Float32Array(MAX_MOVING_FOG*3);readonly size=new Float32Array(MAX_MOVING_FOG);
 readonly intensity=new Float32Array(MAX_MOVING_FOG);readonly maxIntensity=new Float32Array(MAX_MOVING_FOG);readonly speed=new Float32Array(MAX_MOVING_FOG);
 /** MovingFogInit: m_vecWind. */
 readonly wind=new Float32Array([.06,.06,0]);
 /** CurrentFogIntensity (0x8D5798). */
 currentFogIntensity=1;
 /** The sprites as the last native frame drew them (MovingFog_Update runs after the draw). */
 private drawn={count:0,position:new Float32Array(MAX_MOVING_FOG*3),size:new Float32Array(MAX_MOVING_FOG),alpha:new Uint8Array(MAX_MOVING_FOG),colour:[0,0,0] as [number,number,number]};
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private lastTimeMs?:number;private accumulator=0;
 private cameraPosition=new THREE.Vector3();private right=new THREE.Vector3();private up=new THREE.Vector3();
 constructor(scene:THREE.Scene,private random:()=>number=Math.random){
  const geometry=new THREE.BufferGeometry(),uv=new Float32Array(MAX_MOVING_FOG*8),index=new Uint16Array(MAX_MOVING_FOG*6);
  // Corners in MovingFogRender order: TheCamera right + up, right - up, -right - up, -right + up with UVs (0,0), (1,0), (1,1), (0,1); m_nPrimIndices 0,1,2,0,2,3.
  for(let i=0;i<MAX_MOVING_FOG;i++){uv.set([0,0,1,0,1,1,0,1],i*8);index.set([0,1,2,0,2,3].map(v=>i*4+v),i*6);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_MOVING_FOG*12),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('fogColor',new THREE.BufferAttribute(new Uint8Array(MAX_MOVING_FOG*16),4,true).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.setDrawRange(0,0);
  // CPostEffects::ImmediateModeRenderStatesSet (SRCALPHA/INVSRCALPHA, no fog, no culling, no z write) with z test and linear filtering re-enabled.
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending}));
  // RenderEffects: after g_fx and CWaterLevel::RenderWaterFog, before the rain streaks.
  this.mesh.name='Native moving fog';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=5.5;
  scene.add(this.mesh);
 }
 /** CGeneral::GetRandomNumberInRange(float, float). */
 private range(min:number,max:number){return Math.fround(min+(max-min)*this.random());}
 /** MovingFog_GetFirstFreeSlot (0x713710). */
 firstFreeSlot(){for(let i=0;i<MAX_MOVING_FOG;i++)if(!this.slots[i])return i;return -1;}
 /** MovingFog_Create (0x713760). */
 create(camera:NativeFogVec){
  const slot=this.firstFreeSlot();if(slot===-1)return;
  this.position[slot*3]=this.range(-58,58)+camera.x;this.position[slot*3+1]=this.range(-58,58)+camera.y;this.position[slot*3+2]=this.range(-5,5)+camera.z;
  this.size[slot]=this.range(4,10);this.intensity[slot]=1;this.maxIntensity[slot]=this.range(8,20);this.speed[slot]=this.range(.5,1.2);this.slots[slot]=1;
 }
 /** MovingFog_Update (0x716B10). Empty slots fill before they move; sprites fade in within 60 units of the camera and out beyond. */
 update(foggynessSF:number,camera:NativeFogVec,timeStep:number){
  if(foggynessSF===0)return;
  for(let i=0;i<MAX_MOVING_FOG;i++){
   if(!this.slots[i]){this.create(camera);continue;}
   const o=i*3,dx=this.position[o]-camera.x,dy=this.position[o+1]-camera.y,dz=this.position[o+2]-camera.z;
   this.position[o]+=this.wind[0]*this.speed[i];this.position[o+1]+=this.wind[1]*this.speed[i];
   if(Math.fround(Math.sqrt(dx*dx+dy*dy+dz*dz))<=60)this.intensity[i]=Math.min(this.intensity[i]+timeStep,this.maxIntensity[i]);
   else{this.intensity[i]-=timeStep;if(this.intensity[i]<=0)this.slots[i]=0;}
  }
 }
 /** MovingFogRender (0x716C90) for one native frame: CurrentFogIntensity, the draw list, then MovingFog_Update. */
 step(input:MovingFogInput,camera:NativeFogVec,timeStep:number){
  const drawn=this.drawn;drawn.count=0;
  if(input.foggynessSF===0||!input.outside)return;
  const step=timeStep/300;
  this.currentFogIntensity=input.noRain?Math.max(this.currentFogIntensity-step,0):Math.min(this.currentFogIntensity+step,1);
  if(input.underwaterness>=WATER_FX_START_UNDERWATERNESS){this.currentFogIntensity=0;return;}
  if(this.currentFogIntensity===0)return;
  drawn.colour=input.skyBottom.map(c=>Math.min(c+132,255)) as [number,number,number];
  for(let i=0;i<MAX_MOVING_FOG;i++){
   if(!this.slots[i])continue;
   const n=drawn.count++;drawn.position.set(this.position.subarray(i*3,i*3+3),n*3);drawn.size[n]=this.size[i];
   // static_cast<int32> stored through RwIm3DVertexSetRGBA's RwUInt8.
   drawn.alpha[n]=Math.trunc(input.foggynessSF*this.intensity[i]*this.currentFogIntensity)&255;
  }
  this.update(input.foggynessSF,camera,timeStep);
 }
 /** One rendered frame: native frames advance at 30 Hz from `timeMs` (CTimer::m_snTimeInMilliseconds), and the sprites face the current camera. */
 frame(timeMs:number,camera:THREE.Camera,input:MovingFogInput|undefined,texture:THREE.Texture|undefined,paused:boolean){
  camera.getWorldPosition(this.cameraPosition);
  const native={x:this.cameraPosition.x,y:-this.cameraPosition.z,z:this.cameraPosition.y};
  const delta=this.lastTimeMs===undefined?MOVING_FOG_FRAME_MS:Math.max(0,timeMs-this.lastTimeMs);this.lastTimeMs=timeMs;
  if(!paused){
   this.accumulator=Math.min(this.accumulator+delta,MOVING_FOG_FRAME_MS*4);
   // CTimer::ms_fTimeStep is the frame time over 20 ms.
   for(let frames=0;this.accumulator>=MOVING_FOG_FRAME_MS&&frames<3;frames++){this.accumulator-=MOVING_FOG_FRAME_MS;if(input)this.step(input,native,MOVING_FOG_FRAME_MS/20);else this.drawn.count=0;}
  }
  const drawn=this.drawn;this.mesh.visible=!!texture&&!!input&&drawn.count>0;
  if(!this.mesh.visible)return;
  camera.updateMatrixWorld();
  // TheCamera's matrix right is screen-left in RenderWare; up is screen-up.
  this.right.setFromMatrixColumn(camera.matrixWorld,0).normalize().negate();this.up.setFromMatrixColumn(camera.matrixWorld,1).normalize();
  const geometry=this.mesh.geometry,positions=geometry.getAttribute('position') as THREE.BufferAttribute,colours=geometry.getAttribute('fogColor') as THREE.BufferAttribute;
  const [r,g,b]=drawn.colour;
  for(let n=0;n<drawn.count;n++){
   const h=drawn.size[n]/2,px=drawn.position[n*3],py=drawn.position[n*3+2],pz=-drawn.position[n*3+1];
   const rx=this.right.x*h,ry=this.right.y*h,rz=this.right.z*h,ux=this.up.x*h,uy=this.up.y*h,uz=this.up.z*h;
   positions.setXYZ(n*4,px+rx+ux,py+ry+uy,pz+rz+uz);positions.setXYZ(n*4+1,px+rx-ux,py+ry-uy,pz+rz-uz);
   positions.setXYZ(n*4+2,px-rx-ux,py-ry-uy,pz-rz-uz);positions.setXYZ(n*4+3,px-rx+ux,py-ry+uy,pz-rz+uz);
   for(let v=0;v<4;v++)colours.array.set([r,g,b,drawn.alpha[n]],(n*4+v)*4);
  }
  positions.needsUpdate=true;colours.needsUpdate=true;geometry.setDrawRange(0,drawn.count*6);
  this.mesh.material.uniforms.raster.value=texture;
 }
 snapshot(){let active=0,maxAlpha=0;for(let i=0;i<MAX_MOVING_FOG;i++)active+=this.slots[i];for(let n=0;n<this.drawn.count;n++)maxAlpha=Math.max(maxAlpha,this.drawn.alpha[n]);return {active,drawn:this.mesh.visible?this.drawn.count:0,maxAlpha,currentFogIntensity:this.currentFogIntensity,colour:[...this.drawn.colour]};}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
