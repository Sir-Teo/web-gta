import * as THREE from 'three';
import {projectCorona} from './coronaProjection';
import {GAME_CAMERA_FOV} from './cameraProjection';
const lineVertex=`attribute vec4 lineColor;varying vec4 vColor;
void main(){vColor=lineColor;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const displayFragment=`varying vec4 vColor;
void main(){vec4 c=vColor;c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));gl_FragColor=c;
 #include <colorspace_fragment>
}`;
export interface WeatherEffectsInput {
 rain:number;wind:number;windDir:{x:number;y:number;z:number};rainbow:number;
 /** CCullZones no-rain zones and interiors suppress rain rendering. */
 noRain:boolean;
 /** CWeather::UnderWaterness > 0: no streaks, no grain. */
 underwater?:boolean;
 /** CTimeCycle::m_FogReduction, 0–64 (nativeFogReduction). */
 fogReduction?:number;
}
const RAIN_STREAKS=32;
/** CWeather::RenderRainStreaks, CPostEffects' rain grain and CClouds::Render_MaybeRenderRainbows. */
export class NativeWeatherEffects {
 private streakX=new Int32Array(RAIN_STREAKS);private streakY=new Int32Array(RAIN_STREAKS);private streakZ=new Int32Array(RAIN_STREAKS);private streakStrength=new Uint8Array(RAIN_STREAKS);
 private streaksInitialised=false;
 /** CWeather::CurrentRainParticleStrength. */
 rainParticleStrength=0;
 /** CPostEffects s_CurrentStrength for the rain grain. */
 grainStrength=0;
 private lines:THREE.LineSegments<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private grain:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;private grainPixels=new Uint8Array(256*256*4);private grainTexture:THREE.DataTexture;
 private rainbow:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[];
 private forward=new THREE.Vector3();private position=new THREE.Vector3();
 constructor(scene:THREE.Scene,private random:()=>number=Math.random){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RAIN_STREAKS*6),3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('lineColor',new THREE.BufferAttribute(new Float32Array(RAIN_STREAKS*8),4).setUsage(THREE.DynamicDrawUsage));
  this.lines=new THREE.LineSegments(geometry,new THREE.ShaderMaterial({vertexShader:lineVertex,fragmentShader:displayFragment,transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending}));
  this.lines.name='Native rain streaks';this.lines.frustumCulled=false;this.lines.visible=false;this.lines.renderOrder=6;
  this.grainTexture=new THREE.DataTexture(this.grainPixels,256,256,THREE.RGBAFormat);this.grainTexture.wrapS=this.grainTexture.wrapT=THREE.RepeatWrapping;this.grainTexture.magFilter=this.grainTexture.minFilter=THREE.LinearFilter;this.grainTexture.colorSpace=THREE.NoColorSpace;
  this.grain=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{raster:{value:this.grainTexture},uvScale:{value:new THREE.Vector2(1,1)},strength:{value:0}},transparent:true,depthTest:false,depthWrite:false,blending:THREE.NormalBlending,
   vertexShader:'uniform vec2 uvScale;varying vec2 vUv;void main(){vUv=vec2(uv.x,1.-uv.y)*uvScale;gl_Position=vec4(position.xy,0.,1.);}',
   // SRCALPHA/INVSRCALPHA with white vertex colour and alpha = strength: the grey byte is both colour and alpha.
   fragmentShader:`uniform sampler2D raster;uniform float strength;varying vec2 vUv;void main(){vec4 t=texture2D(raster,vUv);vec4 c=vec4(t.rgb,t.a*strength);c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));gl_FragColor=c;
    #include <colorspace_fragment>
   }`}));
  this.grain.name='Native rain grain';this.grain.frustumCulled=false;this.grain.visible=false;this.grain.renderOrder=1000;
  const rainbowColours=[[30,0,0],[30,15,0],[30,30,0],[10,30,10],[0,0,30],[15,0,30]];
  this.rainbow=rainbowColours.map((rgb,i)=>{
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{raster:{value:null},center:{value:new THREE.Vector2()},extent:{value:new THREE.Vector2()},tint:{value:new THREE.Vector3(...rgb.map(c=>c/255))},amount:{value:0}},
    transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    vertexShader:'uniform vec2 center;uniform vec2 extent;varying vec2 vUv;void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=vec4(center+position.xy*extent,1.,1.);}',
    fragmentShader:'uniform sampler2D raster;uniform vec3 tint;uniform float amount;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(raster,vUv).rgb*floor(tint*255.*amount)/255.,0.);}'}));
   mesh.name=`Native rainbow ${i}`;mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=-7;return mesh;
  });
  scene.add(this.lines,this.grain,...this.rainbow);
 }
 private rand(min:number,max:number){return min+(max-min)*this.random();}
 /** One rendered frame. `camera` in browser space; native space is (x, -z, y). */
 update(camera:THREE.PerspectiveCamera,input:WeatherEffectsInput,coronaStar:THREE.Texture|undefined,paused:boolean,viewport:{width:number;height:number}){
  camera.getWorldPosition(this.position);camera.getWorldDirection(this.forward);
  const cam={x:this.position.x,y:-this.position.z,z:this.position.y},fwd={x:this.forward.x,y:-this.forward.z,z:this.forward.y};
  if(!paused)this.updateRainStreaks(cam,fwd,input);
  // RenderRainStreaks draws nothing while the game is paused, under water, or with the camera above 900.
  this.lines.visible=!paused&&this.rainParticleStrength>0&&!input.noRain&&!input.underwater&&cam.z<=900;
  if(!paused){
   // CPostEffects::Render: the grain strength steps by one toward Rain * 128 while rain is enabled or fading.
   if(input.rain>0||this.grainStrength!==0){const target=128*input.rain;if(this.grainStrength<target)this.grainStrength++;else if(this.grainStrength>target)this.grainStrength--;this.grainStrength=Math.max(0,this.grainStrength);}
   const strength=Math.trunc(this.grainStrength/4);
   this.grain.visible=strength>0&&!input.noRain&&!input.underwater&&cam.z<=900;
   if(this.grain.visible){for(let i=0;i<this.grainPixels.length;i+=4){const v=Math.trunc(this.random()*256);this.grainPixels[i]=this.grainPixels[i+1]=this.grainPixels[i+2]=this.grainPixels[i+3]=v;}this.grainTexture.needsUpdate=true;
    // SCREEN_STRETCH_X(1.5) texture repeats across the width, scaled by height / width vertically.
    const ux=1.5*viewport.width/640;this.grain.material.uniforms.uvScale.value.set(ux,viewport.height/viewport.width*ux);this.grain.material.uniforms.strength.value=strength/255;}
  }
  camera.updateMatrixWorld();
  for(const [i,mesh] of this.rainbow.entries()){
   mesh.visible=false;if(!(input.rainbow>0)||!coronaStar)continue;
   // Native offsets (i * 1.5, 100, 5) from the camera, so the arc stands in the north.
   const world=new THREE.Vector3(this.position.x+i*1.5,this.position.y+5,this.position.z-100),projected=projectCorona(camera,world,1,1,GAME_CAMERA_FOV,false);
   if(!projected)continue;
   const u=mesh.material.uniforms;u.raster.value=coronaStar;u.center.value.set(projected.x*2-1,1-projected.y*2);u.extent.value.set(projected.widthScale*2*2,projected.heightScale*50*2);u.amount.value=input.rainbow;mesh.visible=true;
  }
 }
 /** CWeather::RenderRainStreaks (0x72AF70). Streak positions are stored as int32, so their per-frame fall truncates away. */
 private updateRainStreaks(cam:{x:number;y:number;z:number},fwd:{x:number;y:number;z:number},input:WeatherEffectsInput){
  const target=Math.trunc((64-(input.fogReduction??0))*(input.rain*110)/64);
  if(this.rainParticleStrength<target)this.rainParticleStrength++;else if(this.rainParticleStrength>0)this.rainParticleStrength--;
  if(!this.rainParticleStrength||input.noRain||input.underwater||cam.z>900)return;
  if(!this.streaksInitialised){this.streaksInitialised=true;this.streakStrength.fill(Math.trunc(this.rainParticleStrength*.6));}
  const positions=this.lines.geometry.getAttribute('position') as THREE.BufferAttribute,colors=this.lines.geometry.getAttribute('lineColor') as THREE.BufferAttribute;
  for(let s=0;s<RAIN_STREAKS;s++){
   const dx=cam.x-this.streakX[s],dy=cam.y-this.streakY[s],dz=cam.z-this.streakZ[s];
   if(!this.streakStrength[s]||this.streakZ[s]<=0||Math.hypot(dx,dy,dz)>8){
    this.streakX[s]=Math.trunc(this.rand(0,5)+fwd.x*6+cam.x-2.5);this.streakY[s]=Math.trunc(this.rand(0,5)+fwd.y*6+cam.y-2.5);this.streakZ[s]=Math.trunc(this.rand(0,5)+fwd.z*6+cam.z-2.5);
    this.streakStrength[s]=Math.trunc(this.rainParticleStrength*.6);
   }
   const ox=this.rand(-.2,.2),oy=this.rand(-.2,.2),oz=this.rand(-.1,.1),mul=s%2?input.wind*.1:input.wind*input.rain*.1;
   const ex=ox-input.windDir.x*mul,ey=oy-input.windDir.y*mul,ez=oz-input.windDir.z*mul+this.rand(.1,.5);
   const x=this.streakX[s],y=this.streakY[s],z=this.streakZ[s];
   positions.setXYZ(s*2,x+ox,z+oz,-(y+oy));colors.setXYZW(s*2,210/255,210/255,230/255,this.streakStrength[s]/255);
   positions.setXYZ(s*2+1,x+ex,z+ez,-(y+ey));colors.setXYZW(s*2+1,210/255,210/255,230/255,Math.trunc(this.streakStrength[s]/2)/255);
   this.streakZ[s]-=Math.trunc(this.rand(.01,.1));
   this.streakStrength[s]=Math.max(0,this.streakStrength[s]-Math.trunc(this.rand(2,5)));
  }
  positions.needsUpdate=true;colors.needsUpdate=true;
 }
 snapshot(){return {rainStrength:this.rainParticleStrength,grain:this.grainStrength,streaks:this.lines.visible,rainbow:this.rainbow.some(m=>m.visible)};}
 dispose(){this.lines.removeFromParent();this.lines.geometry.dispose();this.lines.material.dispose();this.grain.removeFromParent();this.grain.geometry.dispose();this.grain.material.dispose();this.grainTexture.dispose();for(const m of this.rainbow){m.removeFromParent();m.geometry.dispose();m.material.dispose();}}
}
